export namespace main {
	
	export class AppSettings {
	    locale: string;
	    terminal: string;
	    theme: string;
	    lastDarkTheme: string;
	    lastLightTheme: string;
	    customThemes: string;
	    uiFont: string;
	    monoFont: string;
	    density: string;
	
	    static createFrom(source: any = {}) {
	        return new AppSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.locale = source["locale"];
	        this.terminal = source["terminal"];
	        this.theme = source["theme"];
	        this.lastDarkTheme = source["lastDarkTheme"];
	        this.lastLightTheme = source["lastLightTheme"];
	        this.customThemes = source["customThemes"];
	        this.uiFont = source["uiFont"];
	        this.monoFont = source["monoFont"];
	        this.density = source["density"];
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
	    position: number;
	    values: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new VariablePreset(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.position = source["position"];
	        this.values = source["values"];
	    }
	}
	export class VariableDefinition {
	    name: string;
	    description: string;
	    example: string;
	    default: string;
	    sortOrder: number;
	
	    static createFrom(source: any = {}) {
	        return new VariableDefinition(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.example = source["example"];
	        this.default = source["default"];
	        this.sortOrder = source["sortOrder"];
	    }
	}
	export class Command {
	    id: string;
	    title: sql.NullString;
	    description: sql.NullString;
	    scriptContent: string;
	    tags: string[];
	    variables: VariableDefinition[];
	    presets: VariablePreset[];
	    categoryId: string;
	    position: number;
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
	        this.title = this.convertValues(source["title"], sql.NullString);
	        this.description = this.convertValues(source["description"], sql.NullString);
	        this.scriptContent = source["scriptContent"];
	        this.tags = source["tags"];
	        this.variables = this.convertValues(source["variables"], VariableDefinition);
	        this.presets = this.convertValues(source["presets"], VariablePreset);
	        this.categoryId = source["categoryId"];
	        this.position = source["position"];
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
	    scriptContent: string;
	    finalCmd: string;
	    output: string;
	    error: string;
	    exitCode: number;
	    workingDir: string;
	    // Go type: time
	    executedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new ExecutionRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.commandId = source["commandId"];
	        this.scriptContent = source["scriptContent"];
	        this.finalCmd = source["finalCmd"];
	        this.output = source["output"];
	        this.error = source["error"];
	        this.exitCode = source["exitCode"];
	        this.workingDir = source["workingDir"];
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

export namespace sql {
	
	export class NullString {
	    String: string;
	    Valid: boolean;
	
	    static createFrom(source: any = {}) {
	        return new NullString(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.String = source["String"];
	        this.Valid = source["Valid"];
	    }
	}

}

