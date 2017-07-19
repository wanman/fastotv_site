// load the things we need
var mongoose = require('mongoose');

// define the schema for our programme model
var DeviceSchema = mongoose.Schema({
  name: String,
  created_date: Date
});

// create the model for users and expose it to our app
module.exports = DeviceSchema;


