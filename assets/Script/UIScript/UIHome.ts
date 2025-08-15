
import { _decorator } from 'cc';
import FormMgr from '../UIFrame/FormMgr';
import { UIScreenBase } from '../UIFrame/UIForm';
import UIHome_Auto from './AutoScripts/UIHome_Auto';
import UIConfig from './UIConfig';
const { ccclass, property } = _decorator;

@ccclass('UIHome')
export class UIHome extends UIScreenBase {
    public view: UIHome_Auto | null = null;

    start() {

        this.view?.button?.addClick(() => {
            FormMgr.open(UIConfig.UITestWin);
        }, this);

    }


}
