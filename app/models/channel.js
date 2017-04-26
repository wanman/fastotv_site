// load the things we need
var mongoose = require('mongoose');
var ChannelSchema = require('./channel_scheme');

// create the model for users and expose it to our app
module.exports = mongoose.model('Channel', ChannelSchema);
