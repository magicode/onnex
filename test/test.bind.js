


var onnex = require("..");

require('should');


var onnexServer = onnex.create();

onnexServer.addBind({ host: process.env.IP , port: process.env.PORT } ,function(server){
    onnexServer.closeAll();
});

