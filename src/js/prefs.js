import {Preferences} from "@capacitor/preferences";
/*Preferences.myget = async (key) => {
    return await Preferences.get({key:key});
}
Preferences.myset= async (key,val) => {
    await Preferences.set({key:key,value:val});
    }*/

export let Prefs = new class {
    constructor() {
        this.left = false;
        this.auto = false;
        this.rules = true;
        this.name = "maumee";
        this.load();
    }
    async load() {
        let num;
        if(Preferences) {
            num = await Preferences.get({key:this.name});
        } else {
            console.debug("Using cookies");
            num=Cookies.get(this.name);
        }
        if(num===undefined) {num=1;} else {num=Number(num);}
        this.left = Boolean(num&4);
        this.auto = Boolean(num&2);
        this.rules = Boolean(num&1);
    }
    async save() {
        let code = (this.left<<2) + (this.auto<<1) + (this.rules<<0);
        if(Preferences) {
            await Preferences.set({key:this.name, value:code});
        } else {
            Cookies.set(this.name,code);
        }
    }
    toggle(which) {
        this[which] = !this[which];
        this.save();
    }
}

