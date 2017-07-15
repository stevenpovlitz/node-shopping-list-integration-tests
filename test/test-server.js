const chai = require('chai');
const chaiHttp = require('chai-http');

const {app, runServer, closeServer} = require('../server');

// this lets us use *should* style syntax in our tests
// so we can do things like `(1 + 1).should.equal(2);`
// http://chaijs.com/api/bdd/
const should = chai.should();

// This let's us make HTTP requests
// in our tests.
// see: https://github.com/chaijs/chai-http
chai.use(chaiHttp);

// DRY-functions encapsulating repeat test logic
function getValidation(res, expectedKeys) {
  res.should.have.status(200);
  res.should.be.json;
  res.body.should.be.a('array');

  // because we create three items on app load
  // for shopping-list and two for recipes
  res.body.length.should.be.at.least(1);
  // each item should be an object with key/value pairs
  res.body.forEach(function(item) {
    item.should.be.a('object');
    item.should.include.keys(expectedKeys);
  });
}


// this function does NOT contain the following line:
// res.body.should.include.keys('name', 'ingredients');
function postValidation(res, newItem) {
  res.should.have.status(201);
  res.should.be.json;
  res.body.should.be.a('object');
  res.body.id.should.not.be.null;
  // response should be deep equal to `newItem` from above if we assign
  // `id` to it from `res.body.id`
  res.body.should.deep.equal(Object.assign(newItem, {id: res.body.id}));
}

function putValidation(res, updateData) {
  res.should.have.status(200);
  res.should.be.json;
  res.body.should.be.a('object');
  res.body.should.deep.equal(updateData);
}
// no "deleteValidation" because not enough reused code to justify it

describe('Shopping List', function() {

  // Before our tests run, we activate the server. Our `runServer`
  // function returns a promise, and we return the that promise by
  // doing `return runServer`. If we didn't return a promise here,
  // there's a possibility of a race condition where our tests start
  // running before our server has started.
  before(function() {
    return runServer();
  });

  // although we only have one test module at the moment, we'll
  // close our server at the end of these tests. Otherwise,
  // if we add another test module that also has a `before` block
  // that starts our server, it will cause an error because the
  // server would still be running from the previous tests.
  after(function() {
    return closeServer();
  });

  // test strategy:
  //   1. make request to `/shopping-list`
  //   2. inspect response object and prove has right code and have
  //   right keys in response object.
  it('should list items on GET', function() {
    // for Mocha tests, when we're dealing with asynchronous operations,
    // we must either return a Promise object or else call a `done` callback
    // at the end of the test. The `chai.request(server).get...` call is asynchronous
    // and returns a Promise, so we just return it.
    return chai.request(app)
      .get('/shopping-list')
      .then(function(res) {
        const expectedKeys = ['id', 'name', 'checked'];
        getValidation(res, expectedKeys);
      });
  });

  // test strategy:
  //  1. make a POST request with data for a new item
  //  2. inspect response object and prove it has right
  //  status code and that the returned object has an `id`
  it('should add an item on POST', function() {
    const newItem = {name: 'coffee', checked: false};
    return chai.request(app)
      // so this next line is using "client-side" protocol to post to itself, then
      // inspecting the result?
      .post('/shopping-list')
      .send(newItem)
      .then(function(res) {

        postValidation(res, newItem);
        res.body.should.include.keys('id', 'name', 'checked');
      });
  });

  // test strategy:
  //  1. initialize some update data (we won't have an `id` yet)
  //  2. make a GET request so we can get an item to update
  //  3. add the `id` to `updateData`
  //  4. Make a PUT request with `updateData`
  //  5. Inspect the response object to ensure it
  //  has right status code and that we get back an updated
  //  item with the right data in it.
  it('should update items on PUT', function() {
    // we initialize our updateData here and then after the initial
    // request to the app, we update it with an `id` property so
    // we can make a second, PUT call to the app.
    const updateData = {
      name: 'foo',
      checked: true
    };

    return chai.request(app)
      // first have to get so we have an idea of object to update
      .get('/shopping-list')
      .then(function(res) {
        updateData.id = res.body[0].id;
        // this will return a promise whose value will be the response
        // object, which we can inspect in the next `then` back. Note
        // that we could have used a nested callback here instead of
        // returning a promise and chaining with `then`, but we find
        // this approach cleaner and easier to read and reason about.
        return chai.request(app)
          .put(`/shopping-list/${updateData.id}`)
          .send(updateData);
      })
      // prove that the PUT request has right status code
      // and returns updated item
      .then(function(res) {
        // TODO: figure out why I can't just call like this:
        // .then(putValidation(res, updateData));
        putValidation(res, updateData)
      });
  });

  // test strategy:
  //  1. GET a shopping list items so we can get ID of one
  //  to delete.
  //  2. DELETE an item and ensure we get back a status 204
  it('should delete items on DELETE', function() {
    return chai.request(app)
      // first have to get so we have an `id` of item
      // to delete
      .get('/shopping-list')
      .then(function(res) {
        return chai.request(app)
          .delete(`/shopping-list/${res.body[0].id}`);
      })
      .then(function(res) {
        res.should.have.status(204);
      });
  });
});

describe("recipes", function() {
  // before, after, one normal case test for each function, ~2 edge case tests
  // naming before and after functions for more descriptive console messages
  before(function startingServer() {
    return runServer();
  });

  after(function endingServer(){
    return closeServer();
  });

  it('should GET all recipes', function() {
    return chai.request(app)
      .get('/shopping-list')
      .then(function(res) {
        // why is below checked and id instead of name and ingredients?
        // TODO: figure out if the below is correct - what's with 'checked'?
        const expectedKeys = ['checked', 'id'];
        getValidation(res, expectedKeys);
      });
  });

  it('should POST a new recipe', function() {
    // make item to try and post
    const postItem = {
      "name": "Pork Sandwich",
      "ingredients": ["bread", "meat", "secret sauce"]
    };

    return chai.request(app)
      // largely copied from previous res function
      // ... posible to encapsulate large parts of it?
      .post('/recipes')
      .send(postItem)
      .then(function(res) {
        postValidation(res, postItem);
        res.body.should.include.keys('name', 'ingredients');
      })
  });

  // testing a POST without needed items
  // TODO:get this function to work
  // somewhere, I think I need ".should.throw(Error)"
  it('should fail to POST a new recipe', function() {
    // make item to try and post
    const postItem = {
      "name": "Pork Sandwich",
      // point of failure - should be an array for ingredients here
    };

    return chai.request(app)
      // largely copied from previous res function
      // ... posible to encapsulate large parts of it?
      .post('/recipes')
      .send(postItem)
      .then((function(res) {
          console.log(`STATUS:\n${res.status}`); // debugging code
          // res.should.have.status(204);
        }
      ))
  });

  it('should DELETE a recipe', function() {
    return chai.request(app)
      .get('/recipes')
      .then(function(res) {
        return chai.request(app)
          .delete(`/recipes/${res.body[0].id}`);
      })
      .then(function(res) {
        res.should.have.status(204);
      });
  });

  it('should PUT, successfully updating', function() {
    // TODO: seriously, figure out what's up with these 'checked' values
    // ... did they come out of thin air? what's up? whe do I include it?
    const updateData = {
      name: "american coke",
      ingredients: ["wholesome goodness"],
      //checked: true
    };

    return chai.request(app)
      .get('/recipes')
      .then(function(res) {
        updateData.id = res.body[0].id;
        return chai.request(app)
          .put(`/recipes/${updateData.id}`)
          .send(updateData);
      })
      .then(function(res) {
        putValidation(res, updateData);
      })
  });

});
