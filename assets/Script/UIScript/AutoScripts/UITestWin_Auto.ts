
import { _decorator, Component, Sprite, Button, Label } from 'cc';
const { ccclass, property } = _decorator;
@ccclass("UITestWin_Auto")
export default class UITestWin_Auto extends Component {
	@property(Sprite)
	splash: Sprite | null = null;
	@property(Button)
	button: Button | null = null;
	@property(Label)
	label: Label | null = null;
 
}