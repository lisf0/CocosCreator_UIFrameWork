import { _decorator, AssetManager, AudioClip, AudioSource, Component, find, game, Game, js, Node, sys } from "cc";
import CocosHelper from "./CocosHelper";
import { SysDefine } from "./config/SysDefine";

const { ccclass, property } = _decorator;

enum SoundType {
    MUSIC = "MUSIC",
    EFFECT = "EFFECT",
}

class SoundPlaying {
    type: SoundType;
    source: AudioSource;
    private _endCallback: Function;

    constructor(type: SoundType, source: AudioSource) {
        this.type = type;
        this.source = source;
    }

    get clip(): AudioClip {
        return this.source.clip;
    }
    set clip(value: AudioClip) {
        this.source.clip = value;
    }
    get volume(): number {
        return this.source.volume;
    }
    set volume(value: number) {
        this.source.volume = value;
    }
    get loop(): boolean {
        return this.source.loop;
    }
    set loop(value: boolean) {
        this.source.loop = value;
    }

    setEndCallback(callback: Function) {
        this._endCallback = callback;
    }

    play() {
        this.source.play();

        this.source.node.once(AudioSource.EventType.ENDED, () => {
            // this.source.node.destroy();
            this._endCallback && this._endCallback(this);
        });
    }
}


@ccclass
export default class SoundMgr extends Component {
    private increment = 0;
    public static MUSIC_ON = "MUSIC_ON";
    public static EFFECT_ON = "EFFECT_ON";
    public isMusicOn = 1; //1=播放，0=关闭
    public isEffectOn = 1; //1=播放，0=关闭

    private audioPlaying: { [id: number]: SoundPlaying } = js.createMap();
    private audioCache: { [key: string]: AudioClip } = js.createMap();
    private audioEffectIdCache: { [key: string]: number[] } = js.createMap();

    private static _inst: SoundMgr | null = null;                     // 单例
    public static get inst(): SoundMgr | null {
        if (this._inst == null) {
            let root = find(SysDefine.SYS_UIROOT_NAME);
            if (!root) return null;
            let sound = new Node(SysDefine.SYS_SOUND_NODE);
            sound.parent = root;
            this._inst = sound.addComponent(this);
        }
        return this._inst;
    }

    private currEffectId: number = -1;
    private currMusicId: number = -1;



    public setVolume(id: number, volume: number) {
        if (this.audioPlaying[id]) {
            this.audioPlaying[id].volume = volume;
        }
    }

    /**  */
    public setMusicVolume(volume: number) {
        this.volume.musicVolume = volume;
        this.saveVolumeToLocal();

        for (const key in this.audioPlaying) {
            let audio = this.audioPlaying[key];
            if (audio && audio.type == SoundType.MUSIC) {
                audio.source.volume = volume;
            }
        }
    }
    public setEffectsVolume(volume: number) {
        this.volume.effectVolume = volume;
        this.saveVolumeToLocal();

        for (const key in this.audioPlaying) {
            let audio = this.audioPlaying[key];
            if (audio && audio.type == SoundType.EFFECT) {
                audio.source.volume = volume;
            }
        }
    }

    public stopMusic() {
        for (const key in this.audioPlaying) {
            let audio = this.audioPlaying[key];
            if (audio && audio.type == SoundType.MUSIC) {
                audio.source.stop();
            }
        }
    }

    public pauseAll() {
        for (const key in this.audioPlaying) {
            let audio = this.audioPlaying[key];
            if (audio) {
                audio.source.pause();
            }
        }
    }

    public resumeAll() {
        for (const key in this.audioPlaying) {
            let audio = this.audioPlaying[key];
            if (audio) {
                audio.source.play();
            }
        }
    }

    public stopAll() {
        for (const key in this.audioPlaying) {
            let audio = this.audioPlaying[key];
            if (audio) {
                audio.source.stop();
            }
        }
    }

    public play(clip: AudioClip, loop: boolean = false, type = SoundType.EFFECT) {
        let id = this.increment;
        this.increment++;
        let node = new Node(id.toString());
        node.parent = this.node;
        let source = node.addComponent(AudioSource);
        let playing = this.audioPlaying[id] = new SoundPlaying(type, source);

        playing.clip = clip;
        playing.loop = loop;
        playing.play();
        playing.setEndCallback(() => {
            node.destroy();
            delete this.audioPlaying[id];
        });

        return id;
    }

    public stop(id: number) {
        this.audioPlaying[id]?.source?.stop();
    }

    public resume(id: number) {
        this.audioPlaying[id]?.source?.play();
    }

    onLoad() {
        this.init();
        game.on(Game.EVENT_HIDE, () => {
            this.pauseAll();
        }, this);
        game.on(Game.EVENT_SHOW, () => {
            this.resumeAll();
        }, this);
    }

    public init() {
        this.isMusicOn = sys.localStorage.getItem(SoundMgr.MUSIC_ON);
        if (this.isMusicOn == null) {
            this.isMusicOn = 1;
        }
        this.isEffectOn = sys.localStorage.getItem(SoundMgr.EFFECT_ON);
        if (this.isEffectOn == null) {
            this.isEffectOn = 1;
        }

        let volume = this.getVolumeToLocal();
        if (volume) {
            this.volume = volume;
        } else {
            this.volume.musicVolume = 1;
            this.volume.effectVolume = 1;
        }
        this.setMusicVolume(this.volume.musicVolume);
        this.setEffectsVolume(this.volume.effectVolume);

    }


    public openMusic() {
        this.isMusicOn = 1;
        this.setMusicVolume(1);
        sys.localStorage.setItem(SoundMgr.MUSIC_ON, this.isMusicOn);
    }

    public closeMusic(stop: boolean = true) {
        if (stop) {
            this.stopMusic();
            this.currMusicId = -1;
        }
        this.setMusicVolume(0);
        this.isMusicOn = 0;
        sys.localStorage.setItem(SoundMgr.MUSIC_ON, this.isMusicOn);
    }

    public openEffect() {
        this.isEffectOn = 1;
        this.setEffectsVolume(1);
        sys.localStorage.setItem(SoundMgr.EFFECT_ON, this.isEffectOn);
    }

    public closeEffect() {
        this.isEffectOn = 0;
        this.setEffectsVolume(0);
        sys.localStorage.setItem(SoundMgr.EFFECT_ON, this.isEffectOn);
    }

    /** volume */
    private volume: Volume = new Volume();
    getVolume() {
        return this.volume;
    }


    public async load(bundle: string, url: string) {

        if (url == null) {
            return null;
        }

        let sound = this.audioCache[bundle + url]
        if (!sound) {
            sound = await CocosHelper.loadResFromBundleNameSync<AudioClip>(bundle, url, AudioClip);
            this.audioCache[bundle + url] = sound;
        }

        return sound;
    }

    /** 播放背景音乐 */
    public async playMusic(url: string, loop = true, volume = null) {
        return await this.playMusicFromBundle(AssetManager.BuiltinBundleName.RESOURCES, url, loop, volume);
    }

    public async playMusicFromBundle(bundle: string, url: string, loop = true, volume = null) {
        if (!url || url === "") return;
        if (this.isMusicOn == 0) {
            return;
        }

        let clip = this.audioCache[bundle + url];
        if (clip == null) {
            clip = await this.load(bundle, url);
        }

        this.currMusicId = this.play(clip, loop, SoundType.MUSIC);

        if (volume == null) {
            volume = this.getVolume().musicVolume;
        }
        this.setVolume(this.currMusicId, volume);
        return this.currMusicId;
    }

    /** 播放音效 */
    public async playEffect(url: string, loop = false, volume = null) {
        return await this.playEffectFromBundle(AssetManager.BuiltinBundleName.RESOURCES, url, loop, volume);
    }

    public async playEffectFromBundle(bundle: string, url: string, loop = false, volume = null) {
        if (!url || url === "") return;
        if (this.isEffectOn == 0) {
            return -1;
        }

        let clip = this.audioCache[bundle + url];
        if (clip == null) {
            clip = await this.load(bundle, url);
        }
        this.currEffectId = this.play(clip, loop, SoundType.EFFECT);

        if (this.audioEffectIdCache[bundle + url] == null) {
            this.audioEffectIdCache[bundle + url] = [this.currEffectId];
        } else {
            this.audioEffectIdCache[bundle + url].push(this.currEffectId);
        }

        if (volume == null) {
            volume = this.getVolume().effectVolume;
        }

        this.setVolume(this.currEffectId, volume);
        return this.currEffectId;
    }

    public async stopEffect(id: number = -1) {
        this.stop(id == -1 ? this.currEffectId : id);

        for (const key in this.audioEffectIdCache) {
            const v = this.audioEffectIdCache[key];
            let index = v.findIndex(vv => vv == id);
            if (index >= 0) {
                v.splice(index, 1);
            }
        }
    }

    public stopEffectFromBundle(bundle: string, url: string) {
        if (this.audioEffectIdCache[bundle + url]) {
            this.audioEffectIdCache[bundle + url].forEach(v => {
                this.stop(v);
            })
            this.audioEffectIdCache[bundle + url] = [];
        }
    }

    public getAudioEffectIds(bundle: string, url: string) {
        return this.audioEffectIdCache[bundle + url] || []
    }

    /** 从本地读取 */
    private getVolumeToLocal() {
        let objStr = sys.localStorage.getItem("Volume_For_Creator");
        if (!objStr) {
            return null;
        }
        return JSON.parse(objStr);
    }
    /** 设置音量 */
    private saveVolumeToLocal() {
        sys.localStorage.setItem("Volume_For_Creator", JSON.stringify(this.volume));
    }

    public setEffectActive(active: boolean, id: number = -1) {
        if (active) {
            this.stop(id < 0 ? this.currEffectId : id);
        } else {
            this.resume(id < 0 ? this.currEffectId : id);
        }
    }

    // update (dt) {}
}

class Volume {
    musicVolume: number = 0;
    effectVolume: number = 0;
}