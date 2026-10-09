(function() {
  const callback = ()=>{
    __DEBUGGER__
    window.requestIdleCallback(callback, {timeout:100});
  }
  window.requestIdleCallback(callback, {timeout:100});
})();