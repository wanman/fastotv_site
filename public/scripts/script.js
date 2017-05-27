var STATUS = { 
  OK : "ok",
  FAIL : "fail"
};

var COMMANDS = {
  PING : "server_ping",
  INFO : "get_client_info"
};

// parse string to UserStateInfo
// {std::string user_id; bool connected;}
function parse_state_msg(msg) {
  var user_state_info;
  try {
    user_state_info = JSON.parse(msg);
  } catch (e) {
    return undefined;
  }
  return user_state_info;
}

// is_commands
function is_ping_command(msgObj) {
  return msgObj.command === COMMANDS.PING;    
}
function is_info_command(msgObj) {
  return msgObj.command === COMMANDS.INFO;    
}

// status off command
function is_failed_command(msgObj) {
  return msgObj.state === STATUS.FAIL;    
}

function is_succsess_command(msgObj) {
  return msgObj.state === STATUS.OK;    
}

// parse string to ResponceInfo
// {std::string request_id; std::string state; std::string command; std::string responce_json;}
function parse_command_out(msg) {
  var responce_info;
  try {
    responce_info = JSON.parse(msg);
  } catch (e) {
    return undefined;
  }
  return responce_info;
}

// device functions
function ping_device(user_id, id_cmd, socket) {
  if(user_id === undefined){
    return;
  }
    
  var msg = user_id + " " + id_cmd + " " + COMMANDS.PING;
  socket.emit('publish_redis', msg);
}

function device_info(user_id, id_cmd, socket) {
  if(user_id === undefined){
    return;
  }
    
  var msg = user_id + " " + id_cmd + " " + COMMANDS.INFO;
  socket.emit('publish_redis', msg);
}

//// server_details constant
const SERVER_DEFAULT_LABEL = "Unknown";
const SERVER_CPU_DEFAULT_LABEL = "Unknown";
const SERVER_OS_DEFAULT_LABEL = "Unknown";
const SERVER_RAM_DEFAULT_LABEL = "Unknown";
const SERVER_NETWORK_BANDWIDTH_DEFAULT_LABEL = "Unknown";
var SERVER_STATUS = { 
  ONLINE : "online",
  OFFLINE : "offline"
};

var SERVER_STATUS_IMG = { 
  ONLINE : "images/online.png",
  OFFLINE : "images/offline.png"
};