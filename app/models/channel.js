// load the things we need
var mongoose = require('mongoose');
var consts = require('./consts');

// define the schema for our channel model
var channelSchema = mongoose.Schema({
  url : String,
  name : String,
  price : Number,
  channel_type: {
    type: String,
    enum : consts.CHANNEL_TYPE,
    default: consts.OFFICAL
  }
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Channel', channelSchema);
