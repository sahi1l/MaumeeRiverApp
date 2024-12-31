import {Preferences} from "@capacitor/preferences";
//let Preferences = require("@capacitor/preferences");
//import {Cookies} from "./js/js-cookie.js";
export let Prefs = new class {
    constructor() {
        this.left = false;
        this.auto = false;
        this.rules = true;
        this.name = "maumee";
    }
    async load() {
        let num;
        let text="";
        num = await Preferences.get({key:this.name});
        text += "-P";
        if(num===undefined) {num=1;} else {num=Number(num.value);}
        this.left = Boolean(num&4);
        this.auto = Boolean(num&2);
        this.rules = Boolean(num&1);
    }
    async save() {
        let code = (this.left<<2) + (this.auto<<1) + (this.rules<<0);
        await Preferences.set({key:this.name, value:String(code)});
    }
    toggle(which) {
        this[which] = !this[which];
        this.save();
    }
}

