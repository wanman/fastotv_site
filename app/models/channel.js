// load the things we need
var mongoose = require('mongoose');

var CHANNEL_TYPE = { 
  OFFICAL : 'OFFICAL',
  USER : 'USER'
};

// define the schema for our channel model
var channelSchema = mongoose.Schema({
  url : String,
  name : String,
  price : Number,
  enum : [CHANNEL_TYPE.OFFICAL, CHANNEL_TYPE.USER],
  default: CHANNEL_TYPE.OFFICAL
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Channel', channelSchema);
