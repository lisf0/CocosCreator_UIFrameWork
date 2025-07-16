declare module "cc" {

    export interface Button extends Component {
        // 新增实现内容
        addClick(callback: Function, target: any): void;

    }
}