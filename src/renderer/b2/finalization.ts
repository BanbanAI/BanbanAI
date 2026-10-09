const finalizationRegistry = new FinalizationRegistry<any>((heldValue)=>{
  console.debug("object is garbage collected", heldValue);
});

export {
  finalizationRegistry,
}