const mode=process.argv[2];
if(mode==='api-hang'){process.send?.({type:'api-start'});while(true){}}
else if(mode==='hang'){while(true){}}
else{console.log(JSON.stringify({status:'EXACT'}))}
