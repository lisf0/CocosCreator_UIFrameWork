
import { _decorator, Component } from 'cc';
import FormMgr from './UIFrame/FormMgr';
import UIConfig from './UIScript/UIConfig';
const { ccclass, property } = _decorator;


@ccclass('Main')
export class Main extends Component {

    start() {
        FormMgr.open(UIConfig.UIHome);
    }
}
