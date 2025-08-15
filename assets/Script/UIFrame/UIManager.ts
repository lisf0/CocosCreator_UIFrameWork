import * as cc from "cc";

import { DEBUG } from "cc/env";
import { LRUCache } from "../Common/Utils/LRUCache";
import AdapterMgr, { AdapterType } from "./AdapterMgr";
import { FormType, SysDefine } from "./config/SysDefine";
import { EventCenter } from "./EventCenter";
import { EventType } from "./EventType";
import ModalMgr from "./ModalMgr";
import ResMgr from "./ResMgr";
import { ECloseType, IFormConfig, IFormData } from "./Struct";
import UIBase from "./UIBase";
import { UIWindowBase } from "./UIForm";

/**
 * @author honmono
 */
const TAG = "UIManager";
export default class UIManager {
    private _UIROOT: cc.Node | null = null;    // UIROOT
    private _ndScreen: cc.Node | null = null;  // 全屏显示的UI 挂载结点
    private _ndFixed: cc.Node | null = null;  // 固定显示的UI
    private _ndPopUp: cc.Node | null = null;  // 弹出窗口
    private _ndToast: cc.Node | null = null;  // toast
    private _ndTips: cc.Node | null = null;  // 独立窗体

    private _windows: UIWindowBase[] = [];                   // 存储弹出的窗体
    private _allForms: { [key: string]: UIBase | null } = cc.js.createMap();    // 所有已经挂载的窗体, 可能没有显示
    private _showingForms: { [key: string]: UIBase | null } = cc.js.createMap();    // 正在显示的窗体
    private _tipsForms: { [key: string]: UIBase | null } = cc.js.createMap();    // 独立窗体 独立于其他窗体, 不受其他窗体的影响
    private _loadingForm: { [key: string]: ((value: UIBase) => void)[] } = cc.js.createMap();    // 正在加载的form
    private _closingForm: { [key: string]: UIBase | null } = cc.js.createMap();    // 正在关闭的form
    private _LRUCache: LRUCache = new LRUCache(3);                                             // LRU cache

    private static _sceneComp?: (new () => cc.Component);
    public static init(comp?: (new () => cc.Component)) {
        this._sceneComp = comp;
    }
    private static instance: UIManager | null = null;                                                 // 单例
    public static getInstance(): UIManager {
        if (this.instance == null) {
            if (this._sceneComp == null) {
                console.error(`Missing scene component, please set UIManager.init(SceneComponent);`);
                return null;
            }

            this.instance = new UIManager();
            let canvas = cc.director.getScene()?.getChildByName("Canvas");
            if (!canvas) return this.instance;
            let scene: any = canvas.getChildByName(SysDefine.SYS_SCENE_NODE);
            if (!scene) {
                scene = new cc.Node(SysDefine.SYS_SCENE_NODE);
                scene.addComponent(this._sceneComp);
                scene.parent = canvas;
            } else {
                !(scene.getComponent(this._sceneComp)) && scene.addComponent(this._sceneComp);
            }
            let UIROOT = this.instance._UIROOT = new cc.Node(SysDefine.SYS_UIROOT_NODE);
            scene.addChild(UIROOT);

            UIROOT.addChild(this.instance._ndScreen = new cc.Node(SysDefine.SYS_SCREEN_NODE));
            UIROOT.addChild(this.instance._ndFixed = new cc.Node(SysDefine.SYS_FIXED_NODE));
            UIROOT.addChild(this.instance._ndPopUp = new cc.Node(SysDefine.SYS_POPUP_NODE));
            UIROOT.addChild(this.instance._ndToast = new cc.Node(SysDefine.SYS_TOAST_NODE));
            UIROOT.addChild(this.instance._ndTips = new cc.Node(SysDefine.SYS_TOPTIPS_NODE));
            cc.director.once(cc.Director.EVENT_BEFORE_SCENE_LAUNCH, () => {
                this.instance = null;
            });
        }
        return this.instance;
    }

    /** 预加载UIForm */
    public async loadUIForm(form: IFormConfig): Promise<UIBase> {
        const bundleName = form.bundleName;
        const prefabPath = form.prefabUrl;
        let uiBase = await this._loadForm(bundleName, prefabPath);
        if (!uiBase) {
            console.warn(`${uiBase}没有被成功加载`);
            return null;
        }
        cc.log(`预加载窗体: ${bundleName}-${prefabPath}`);
        return uiBase;
    }

    /**
     * 加载显示一个UIForm
     * @param prefabPath 
     * @param params 
     * @param formData 
     * @returns 
     */
    public async openForm(form: IFormConfig, params?: any, formData?: IFormData, loaded?: (value: UIBase) => void, failed?: (value: Error) => void): Promise<UIBase | null> {
        const bundleName = form.bundleName;
        const prefabPath = form.prefabUrl;
        const fid = `${bundleName}-${prefabPath}`;

        if (!prefabPath || prefabPath.length <= 0) {
            cc.warn(`${bundleName}-${prefabPath}, 参数错误`);
            if (failed) {
                failed(new Error(`${bundleName}-${prefabPath}, 参数错误`));
            }
            return;
        }
        if (this.checkFormShowing(fid)) {
            cc.warn(`${bundleName}-${prefabPath}, 窗体正在显示中`);
            if (failed) {
                failed(new Error(`${bundleName}-${prefabPath}, 窗体正在显示中`));
            }
            return null;
        }
        let com = await this._loadForm(bundleName, prefabPath);
        if (!com) {
            cc.warn(`${bundleName}-${prefabPath} 加载失败了!`);
            if (failed) {
                failed(new Error(`${bundleName}-${prefabPath} 加载失败了!`));
            }
            return null;
        }

        if (this.checkFormCloseing(fid)) {
            cc.warn(`${bundleName}-${prefabPath}, 窗体正在关闭中`);
            if (failed) {
                failed(new Error(`${bundleName}-${prefabPath}, 窗体正在关闭中`));
            }
            return;
        }

        if (loaded) {
            loaded(com);
        }
        cc.log(`打开窗体: ${bundleName}-${prefabPath},params: ${params}`);
        // 初始化窗体名称
        com.fid = fid;
        com.formData = formData;

        switch (com.formType) {
            case FormType.Screen:
                await this.enterToScreen(com.fid, params);
                break;
            case FormType.Fixed:
                await this.enterToFixed(com.fid, params);
                break;
            case FormType.Window:
                await this.enterToPopup(com.fid, params);
                break;
            case FormType.Tips:                                  // 独立显示
                await this.enterToTips(com.fid, params);
                break;
        }

        // 如果这个窗体在lru中存在, 那么立即删除它
        if (com.closeType === ECloseType.LRU) {
            this._LRUCache.remove(com.fid);
        }

        return com;
    }

    /**
     * 重要方法 关闭一个UIForm
     * @param prefabPath
     */
    public async closeForm(
        form: IFormConfig,
        params?: any,
        formData?: IFormData
    ): Promise<boolean> {
        let bundleName = form.bundleName;
        let prefabPath = form.prefabUrl;
        const fid = `${bundleName}-${prefabPath}`;
        if (!prefabPath || prefabPath.length <= 0) {
            cc.warn(TAG, `${bundleName}-${prefabPath}, 参数错误`);
            return false;
        }
        let com = this._allForms[fid];
        if (!com) return false;

        if (this._closingForm[fid]) {
            cc.warn(TAG, `${bundleName}-${prefabPath}, form正在关闭中`);
            return;
        }
        cc.log(`关闭窗体: ${bundleName}-${prefabPath}`);
        this._closingForm[fid] = com;

        switch (com.formType) {
            case FormType.Screen:
                await this.exitToScreen(fid, params);
                break;
            case FormType.Fixed: // 普通模式显示
                await this.exitToFixed(fid, params);
                break;
            case FormType.Window:
                await this.exitToPopup(fid, params);
                EventCenter.emit(EventType.WindowClosed, form);
                break;
            case FormType.Tips:
                await this.exitToTips(fid, params);
                break;
        }

        EventCenter.emit(EventType.FormClosed, form);

        if (com.formData) {
            com.formData.onClose && com.formData.onClose();
        }

        // 根据closeType 处理
        switch (com.closeType) {
            case ECloseType.CloseAndDestory:
                this.destoryForm(com);
                break;
            case ECloseType.LRU:
                this.putLRUCache(com);
                break;
        }

        // 从_closingForm去除
        this._closingForm[fid] = null;
        delete this._closingForm[fid];

        return true;
    }

    /**
     * 从窗口缓存中加载(如果没有就会在load加载), 并挂载到结点上
     */
    private async _loadForm(bundleName: string, prefabPath: string): Promise<UIBase> {
        const fid = `${bundleName}-${prefabPath}`;
        let com = this._allForms[fid];
        if (com) return com;
        return new Promise((resolve, reject) => {
            if (this._loadingForm[fid]) {
                this._loadingForm[fid].push(resolve);
                return;
            }
            this._loadingForm[fid] = [resolve];
            this._doLoadUIForm(bundleName, prefabPath).then((com: UIBase) => {
                for (const func of this._loadingForm[fid]) {
                    func(com);
                }
                this._loadingForm[fid] = null;
                delete this._loadingForm[fid];
            });
        });
    }

    /**
     * @param prefabPath
     */
    private async _doLoadUIForm(bundleName: string, prefabPath: string): Promise<UIBase> {
        const fid = `${bundleName}-${prefabPath}`;
        let prefab = await ResMgr.inst.loadFormPrefab(bundleName, prefabPath);
        let node = cc.instantiate(prefab);
        let com = this.addNode(node);
        this._allForms[fid] = com;

        return com;
    }

    public addNode(node: cc.Node) {
        let com = node.getComponent(UIBase);
        if (!com) {
            cc.warn(`${node.name} 结点没有绑定UIBase`);
            return null;
        }
        node.active = false;                    // 避免baseCom调用了onload方法
        switch (com.formType) {
            case FormType.Screen:
                this._ndScreen?.addChild(node);
                break;
            case FormType.Fixed:
                this._ndFixed?.addChild(node);
                break;
            case FormType.Window:
                this._ndPopUp?.addChild(node);
                break;
            case FormType.Toast:
                this._ndToast?.addChild(node);
                break;
            case FormType.Tips:
                this._ndTips?.addChild(node);
                break;
        }

        return com;
    }

    /** 添加到screen中 */
    private async enterToScreen(fid: string, params: any) {
        // 关闭其他显示的窗口 
        await this.closeShowingForms();

        let com = this._allForms[fid];
        if (!com) return;
        this._showingForms[fid] = com;

        AdapterMgr.inst.adapteByType(AdapterType.StretchHeight | AdapterType.StretchWidth, com.node);

        await com._preInit(params);
        com.onShow(params);

        await this.showEffect(com);
        com.onAfterShow(params);
    }

    public async closeShowingForms() {
        let arr: Array<Promise<boolean>> = [];
        for (let key in this._showingForms) {
            if (this._showingForms[key]) {
                arr.push(this._showingForms[key].closeSelf());
            }
        }
        await Promise.all(arr);
    }

    /** 添加到Fixed中 */
    private async enterToFixed(fid: string, params: any) {
        let com = this._allForms[fid];
        if (!com) return;
        await com._preInit(params);

        com.onShow(params);
        this._showingForms[fid] = com;
        await this.showEffect(com);
        com.onAfterShow(params);
    }

    /** 添加到popup中 */
    private async enterToPopup(fid: string, params: any) {
        let com = this._allForms[fid] as UIWindowBase;
        if (!com) return;
        await com._preInit(params);

        this._windows.push(com);

        for (let i = 0; i < this._windows.length; i++) {
            this._windows[i].node.setSiblingIndex(i + 1);
        }

        com.onShow(params);
        this._showingForms[fid] = com;

        ModalMgr.inst.checkModalWindow(this._windows);
        await this.showEffect(com);
        com.onAfterShow(params);
    }

    /** 加载到tips中 */
    private async enterToTips(fid: string, params: any) {
        let com = this._allForms[fid];
        if (!com) return;
        await com._preInit(params);
        this._tipsForms[fid] = com;

        com.onShow(params);
        await this.showEffect(com);
        com.onAfterShow(params);
    }

    /** 加载到toast中 */
    public async enterToToast(com: UIBase, params: any) {
        await com._preInit(params);

        com.onShow(params);
        await this.showEffect(com);
        com.onAfterShow(params);
    }

    private async exitToScreen(fid: string, params?: any) {
        let com = this._showingForms[fid];
        if (!com) return;
        com.onHide(params);
        await this.hideEffect(com);
        com.onAfterHide(params);

        this._showingForms[fid] = null;
        delete this._showingForms[fid];
    }

    private async exitToFixed(fid: string, params?: any) {
        let com = this._allForms[fid];
        if (!com) return;
        com.onHide(params);
        await this.hideEffect(com);
        com.onAfterHide(params);

        this._showingForms[fid] = null;
        delete this._showingForms[fid];
    }

    private async exitToPopup(fid: string, params?: any) {
        if (this._windows.length <= 0) return;
        let com: UIWindowBase | null = null;
        for (let i = this._windows.length - 1; i >= 0; i--) {
            if (this._windows[i].fid === fid) {
                com = this._windows[i];
                this._windows.splice(i, 1);
            }
        }
        if (!com) return;

        com.onHide(params);
        ModalMgr.inst.checkModalWindow(this._windows);
        await this.hideEffect(com);
        com.onAfterHide(params);

        this._showingForms[fid] = null;
        delete this._showingForms[fid];
    }

    private async exitToTips(fid: string, params?: any) {
        let com = this._allForms[fid];
        if (!com) return;
        com.onHide(params);
        await this.hideEffect(com);
        com.onAfterHide(params);

        this._tipsForms[fid] = null;
        delete this._tipsForms[fid];
    }

    public async exitToToast(com: UIBase, params?: any) {
        com.onHide(params);
        await this.hideEffect(com);
        com.onAfterHide(params);
    }

    private async showEffect(baseUI: UIBase) {
        baseUI.node.active = true;
        !(baseUI.formData?.quick) && await baseUI.showEffect();
    }
    private async hideEffect(baseUI: UIBase) {
        !(baseUI.formData?.quick) && await baseUI.hideEffect();
        baseUI.node.active = false;
    }

    /** 销毁 */
    private destoryForm(com: UIBase) {
        // 取消所有监听
        EventCenter.targetOff(com);
        // 销毁node
        com.node.destroy();
        // 销毁prefab以及依赖的资源
        ResMgr.inst.destoryFormPrefab(com.fid);
        // 销毁动态加载的资源
        ResMgr.inst.destoryDynamicRes(com.fid);
        // 从allmap中删除
        this._allForms[com.fid] = null;
        delete this._allForms[com.fid];
    }

    /** LRU缓存控制 */
    private putLRUCache(com: UIBase) {
        this._LRUCache.put(com.fid);
        if (!this._LRUCache.needDelete()) return;
        let deleteFid = this._LRUCache.deleteLastNode();
        if (deleteFid) {

            DEBUG && console.log('close form id:', deleteFid, this._LRUCache.toString())
            let com = this.getForm(deleteFid);
            if (!com || !com.node) return;
            com && this.destoryForm(com);
        }

    }


    /** 窗体是否正在显示 */
    public checkFormShowing(fid: string) {
        let com = this._allForms[fid];
        if (!com) return false;

        if (this.checkFormCloseing(fid)) {
            return false;
        }

        return com.node.active;
    }

    /** 窗体是否正在关闭中 */
    public checkFormCloseing(fid: string) {
        return this._closingForm[fid] != null;
    }

    /** 窗体是否正在加载 */
    public checkFormLoading(prefabPath: string) {
        let com = this._loadingForm[prefabPath];
        return !!com;
    }

    /** 获得Component */
    public getForm(fId: string) {
        return this._allForms[fId];
    }

    public getUIROOT() {
        return this._UIROOT;
    }
}

if (DEBUG) {
    //@ts-ignore
    window['UIManager'] = UIManager;
}