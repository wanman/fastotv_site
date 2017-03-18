// load the things we need
var mongoose = require('mongoose');

// define the schema for our channel model
var channelSchema = mongoose.Schema({
  url : String,
  name : String
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Channel', channelSchema);
