// load the things we need
var mongoose = require('mongoose');

// define the schema for our programme model
var ProgrammeSchema = mongoose.Schema({
  start : Date,
  stop : Date,
  channel : String,
  title : String,
  description : String
});

// create the model for users and expose it to our app
module.exports = ProgrammeSchema;


