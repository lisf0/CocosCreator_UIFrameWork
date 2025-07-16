import * as cc from "cc";

import CocosHelper from "./CocosHelper";
import { ModalOpacity } from "./config/SysDefine";
import { UIWindow } from "./UIForm";
import UIManager from "./UIManager";
import WindowMgr from "./WindowMgr";


/**
 * @Author: honmono 
 * @Describe: 
 * @Date: 2019-05-30 23:35:26  
 * @Last Modified time: 2019-05-30 23:35:26 
 */
const { ccclass, property } = cc._decorator;

@ccclass('UIModalScript')
export default class UIModalScript extends cc.Component {

    public fid: string = '';

    private sprite: cc.Sprite | null = null;
    /**
     * 初始化
     */
    public init() {

        let size = cc.view.getVisibleSize();
        let trans = this.node.addComponent(cc.UITransform);
        if (trans) {
            trans.height = size.height;
            trans.width = size.width;
        }

        this.node.addComponent(cc.Button);
        this.node.on('click', this.clickMaskWindow, this);

        let sprite = this.sprite = this.node.addComponent(cc.Sprite)
        sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        sprite.type = cc.Sprite.Type.SIMPLE;

        let spriteFrame = new cc.SpriteFrame();
        spriteFrame.texture = this.getSingleTexture();
        sprite.spriteFrame = spriteFrame;

        let UIOpacity = this.node.addComponent(cc.UIOpacity);
        if (UIOpacity) {
            UIOpacity.opacity = 0;
        }
        sprite.color = new cc.Color(0, 0, 0);
        this.node.active = false;
    }

    // 
    public async showModal(lucenyType: number, time: number = 0.6, isEasing: boolean = true) {
        let o = 0;
        switch (lucenyType) {
            case ModalOpacity.None:
                this.node.active = false;
                break;
            case ModalOpacity.OpacityZero:
                o = 0;
                break;
            case ModalOpacity.OpacityLow:
                o = 63;
                break;
            case ModalOpacity.OpacityHalf:
                o = 126;
                break;
            case ModalOpacity.OpacityHigh:
                o = 189;
                break;
            case ModalOpacity.OpacityFull:
                o = 255;
                break;
        }
        if (!this.node.active) return;
        let UIOpacity = this.node.getComponent(cc.UIOpacity);
        if (UIOpacity) {
            if (isEasing) {
                await CocosHelper.runTweenSync(UIOpacity, cc.tween().to(time, { opacity: o }));
            } else {
                UIOpacity.opacity = o;
            }
        }
    }

    public async clickMaskWindow() {
        let com = UIManager.getInstance().getForm(this.fid) as UIWindow;
        if (com && com.modalType.clickMaskClose) {
            await WindowMgr.close(this.fid);
        }
    }

    private getSingleTexture() {
        let data: any = new Uint8Array(2 * 2 * 4);
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                data[i * 2 * 4 + j * 4 + 0] = 255;
                data[i * 2 * 4 + j * 4 + 1] = 255;
                data[i * 2 * 4 + j * 4 + 2] = 255;
                data[i * 2 * 4 + j * 4 + 3] = 255;
            }
        }
        let texture = new cc.Texture2D();
        texture.reset({
            width: 2,
            height: 2,
            format: cc.Texture2D.PixelFormat.RGBA8888
        });
        texture.name = 'single color'

        texture.uploadData(data, 0);

        // this._texture = texture;
        // texture.packable = true;
        // texture.addRef();

        return texture;
    }

}