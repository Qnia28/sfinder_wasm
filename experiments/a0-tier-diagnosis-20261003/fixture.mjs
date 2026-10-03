process.send({type:'engine-ready',pid:process.pid,execArgv:process.execArgv});
process.send({type:'session-ready'});
process.on('message',m=>{if(m.type==='close')process.disconnect();else process.send({type:'echo',value:m});});
