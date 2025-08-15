
import { _decorator, Component } from 'cc';
import FormMgr from './UIFrame/FormMgr';
import UIManager from './UIFrame/UIManager';
import UIConfig from './UIScript/UIConfig';
const { ccclass, property } = _decorator;


@ccclass('Main')
export class Main extends Component {

    start() {

        UIManager.init(Main);

        FormMgr.open(UIConfig.UIHome);
    }
}
