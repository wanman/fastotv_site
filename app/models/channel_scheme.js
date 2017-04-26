// load the things we need
var mongoose = require('mongoose');

// define the schema for our channel model
var channelSchema = mongoose.Schema({
  url : String,
  name : String,
  price : {type : Number, default: 0}
});
