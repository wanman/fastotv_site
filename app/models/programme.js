// load the things we need
var mongoose = require('mongoose');

// define the schema for our programme model
var ProgrammeSchema = mongoose.Schema({
  channel: String,
  start: Date,
  end: Date,
  title:  [String],
  desc: [String],
  category: [String],
  episodeNum: [Object],
  length: Number,
  country: [String],
  rating: [Object]
});

// create the model for users and expose it to our app
module.exports = ProgrammeSchema;


