
import { _decorator, log, Texture2D } from 'cc';
import { UIWindow } from '../UIFrame/UIForm';
import UITestWin_Auto from './AutoScripts/UITestWin_Auto';
const { ccclass, property } = _decorator;

@ccclass('UITestWin')
export class UITestWin extends UIWindow {
    public view: UITestWin_Auto | null = null;

    createTexture() {
        let texture = new Texture2D();
        texture.reset({
            width: 2,
            height: 2,
            format: Texture2D.PixelFormat.RGBA8888
        });
        let data = new Int8Array([
            255, 0, 0, 255,
            255, 0, 0, 255,
            255, 0, 0, 255,
            255, 0, 0, 255,
        ]);
        texture.uploadData(data, 0);

        return texture;
    }
    start() {


        // let t = this.node.addComponent(UITransform);
        // t.width = 1000;
        // t.height = 1000;


        // let sprite = this.node.addComponent(Sprite)
        // sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        // sprite.type = Sprite.Type.SIMPLE;
        // let spriteFrame = new SpriteFrame();
        // spriteFrame.texture = this.createTexture();
        // sprite.spriteFrame = spriteFrame;


        this.view?.button?.addClick(() => {
            log("close test win");
            this.closeSelf();
        }, this);


    }


}
