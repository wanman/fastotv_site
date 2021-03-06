var amqp = require('amqp')

var TIMEOUT = 10 * 60000; //time to wait for response in ms
var CONTENT_TYPE = 'application/json';

exports = module.exports = AmqpRpc;

function AmqpRpc(connection) {
  var self = this;
  this.connection = typeof(connection) !== 'undefined' ? connection : amqp.createConnection();
  this.requests = {}; //hash to store request in wait for response
  this.response_queue = false; //plaseholder for the future queue
}

AmqpRpc.prototype.makeRequest = function (queue_name, correlationId, content, callback, status_callback) {
  var self = this;
  //create a timeout for what should happen if we don't get a response
  var tId = setTimeout(function (corr_id) {
    //if this ever gets called we didn't get a response in a
    //timely fashion
    callback(new Error("timeout " + corr_id));
    //delete the entry from hash
    delete self.requests[corr_id];
  }, TIMEOUT, correlationId);

  //create a request entry to store in a hash
  var entry = {
    callback: callback,
    status_callback: status_callback,
    timeout: tId //the id for the timeout so we can clear it
  };

  //put the entry in the hash so we can match the response later
  self.requests[correlationId] = entry;

  //make sure we have a response queue
  self.setupResponseQueue(function () {
    //put the request on a queue
    self.connection.publish(queue_name, content, {
      correlationId: correlationId,
      contentEncoding: 'utf-8',
      contentType: CONTENT_TYPE,
      replyTo: self.response_queue
    });
  });
}


AmqpRpc.prototype.setupResponseQueue = function (next) {
  //don't mess around if we have a queue
  if (this.response_queue) return next();

  var self = this;

  //create the queue
  self.connection.queue('', {exclusive: true}, function (q) {
    //store the name
    self.response_queue = q.name;
    //subscribe to messages
    q.subscribe(function (message, headers, deliveryInfo, m) {
      //get the correlationId
      var correlationId = m.correlationId;
      var type = headers.type;

      //is it a response to a pending request
      if (correlationId in self.requests) {
        //retreive the request entry
        if (type === 'response') {
          var response_entry = self.requests[correlationId];
          //make sure we don't timeout by clearing it
          clearTimeout(response_entry.timeout);
          //delete the responce_entry from hash
          delete self.requests[correlationId];
          //callback, no err
          response_entry.callback(null, message);
        } else if (type === 'status') {
          var status_entry = self.requests[correlationId];
          status_entry.status_callback(message);
        }
      }
    });
    return next();
  });
}
