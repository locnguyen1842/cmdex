export namespace main {
	
	export class AppSettings {
	    locale: string;
	    terminal: string;
	
	    static createFrom(source: any = {}) {
	        return new AppSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.locale = source["locale"];
	        this.terminal = source["terminal"];
	    }
	}
	export class Category {
	    id: string;
	    name: string;
	    icon: string;
	    color: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Category(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.icon = source["icon"];
	        this.color = source["color"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class VariablePreset {
	    id: string;
	    name: string;
	    values: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new VariablePreset(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.values = source["values"];
	    }
	}
	export class VariableDefinition {
	    name: string;
	    description: string;
	    example: string;
	    default: string;
	
	    static createFrom(source: any = {}) {
	        return new VariableDefinition(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.example = source["example"];
	        this.default = source["default"];
	    }
	}
	export class Command {
	    id: string;
	    title: string;
	    description: string;
	    commandText: string;
	    tags: string[];
	    variables: VariableDefinition[];
	    presets: VariablePreset[];
	    categoryId: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Command(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.commandText = source["commandText"];
	        this.tags = source["tags"];
	        this.variables = this.convertValues(source["variables"], VariableDefinition);
	        this.presets = this.convertValues(source["presets"], VariablePreset);
	        this.categoryId = source["categoryId"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ExecutionRecord {
	    id: string;
	    commandId: string;
	    commandText: string;
	    finalCmd: string;
	    output: string;
	    error: string;
	    exitCode: number;
	    // Go type: time
	    executedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new ExecutionRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.commandId = source["commandId"];
	        this.commandText = source["commandText"];
	        this.finalCmd = source["finalCmd"];
	        this.output = source["output"];
	        this.error = source["error"];
	        this.exitCode = source["exitCode"];
	        this.executedAt = this.convertValues(source["executedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TerminalInfo {
	    id: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new TerminalInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	    }
	}
	
	
	export class VariablePrompt {
	    name: string;
	    placeholder: string;
	    description: string;
	    example: string;
	    defaultExpr: string;
	    defaultValue: string;
	
	    static createFrom(source: any = {}) {
	        return new VariablePrompt(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.placeholder = source["placeholder"];
	        this.description = source["description"];
	        this.example = source["example"];
	        this.defaultExpr = source["defaultExpr"];
	        this.defaultValue = source["defaultValue"];
	    }
	}

}

