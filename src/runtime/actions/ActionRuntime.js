const clone=value=>structuredClone(value);

export class ActionRuntime {
  constructor({catalog=null,handlers={}}={}){
    this.catalog=catalog&&typeof catalog==="object"?clone(catalog):{schema:"tq.action-catalog",version:1,actions:[]};
    this.handlers=new Map();
    for(const [id,handler] of Object.entries(handlers||{}))this.register(id,handler);
  }

  setCatalog(catalog){
    this.catalog=catalog&&typeof catalog==="object"?clone(catalog):{schema:"tq.action-catalog",version:1,actions:[]};
    return this;
  }

  list(){
    return Array.isArray(this.catalog?.actions)?clone(this.catalog.actions):[];
  }

  get(id){
    return this.list().find(action=>action.id===String(id||""))||null;
  }

  register(id,handler){
    if(!id||typeof handler!=="function")return this;
    this.handlers.set(String(id),handler);
    return this;
  }

  canExecute(id){
    return this.handlers.has(String(id||""));
  }

  async execute(action,context={}){
    const descriptor=typeof action==="string"
      ?{actionId:action,params:{}}
      :(action&&typeof action==="object"?action:{});
    const actionId=String(descriptor.actionId||descriptor.id||"");
    if(!actionId)throw new Error("ActionRuntime requires actionId");
    const handler=this.handlers.get(actionId);
    if(!handler)throw new Error("No handler registered for action: "+actionId);
    return handler({
      actionId,
      params:clone(descriptor.params||{}),
      context:clone(context||{}),
      definition:this.get(actionId)
    });
  }
}
