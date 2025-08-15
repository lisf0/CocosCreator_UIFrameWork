import { log } from "cc";
import PriorityQueue from "../Common/Utils/PriorityQueue";
import PriorityStack from "../Common/Utils/PriorityStack";
import { FormType, SysDefine } from "./config/SysDefine";
import { EPriority, GetForm, IFormConfig, IFormData } from "./Struct";
import TipsMgr from "./TipsMgr";
import UIManager from "./UIManager";


class WindowData {
    form: IFormConfig | null = null;
    params?: any;
    formData?: any;
}

class WindowMgr {
    // 窗体
    private _showingList: PriorityStack<IFormConfig> = new PriorityStack((a: IFormConfig, b: IFormConfig) => a.prefabUrl === b.prefabUrl);
    private _waitingList: PriorityQueue<WindowData> = new PriorityQueue();

    private _currWindow: IFormConfig | null = null;
    public get currWindow() {
        return this._currWindow;
    }

    public getWindows() {
        return this._showingList.getElements();
    }

    /** 打开窗体 */
    public async open(form: IFormConfig | string, params?: any, formData?: IFormData) {
        form = GetForm(form, FormType.Window);
        formData = this._formatFormData(formData);
        if (this._showingList.size <= 0 || formData && (!formData.showWait && (formData.priority || EPriority.ZERO) >= this._showingList.getTopEPriority())) {
            this._showingList.push(form, formData?.priority);
            this._currWindow = this._showingList.getTopElement();
            let loadingActive = formData?.loadingActive == null ? true : formData.loadingActive;

            let url = form.prefabUrl;
            if (loadingActive) {

                log(`${url} show loading`);
                await this.openLoading(formData?.loadingForm, params, formData);
            }

            return await UIManager.getInstance().openForm(form, params, formData, () => {
                if (loadingActive) {
                    log(`${url} loaded close loading`);
                    this.closeLoading(formData?.loadingForm);
                }
            }, () => {
                if (loadingActive) {
                    log(`${url} failed close loading`);
                    this.closeLoading(formData?.loadingForm);
                }
            });
        }

        // 入等待队列
        this._waitingList.enqueue({ form: form, params: params, formData: formData });
        // 加载窗体
        return await UIManager.getInstance().loadUIForm(form);
    }

    public async close(form: IFormConfig | string, params?: any, formData?: IFormData) {
        form = GetForm(form, FormType.Window);
        let result = this._showingList.remove(form);
        if (!result) return false;

        await UIManager.getInstance().closeForm(form, params, formData);

        if (this._showingList.size <= 0 && this._waitingList.size > 0) {
            let windowData = this._waitingList.dequeue();
            if (windowData == null || windowData.form == null) {
                return false;
            }
            this.open(windowData.form, windowData.params, windowData.formData);

        }
        return true;
    }

    /** 关闭所有弹窗 */
    public async closeAll() {
        this._waitingList.clear();

        for (const fid of this._showingList.getElements()) {
            await UIManager.getInstance().closeForm(fid);
        }
        this._showingList.clear();

        return true;
    }

    private _formatFormData(formData: any) {
        return Object.assign({ showWait: false, priority: EPriority.FIVE }, formData);
    }

    private async openLoading(
        formConfig: IFormConfig,
        params: any,
        formData: IFormData
    ) {
        let form = formConfig || SysDefine.defaultLoadingForm;
        if (!form) return;
        await TipsMgr.open(form, params, formData);
    }
    private async closeLoading(formConfig: IFormConfig) {
        let form = formConfig || SysDefine.defaultLoadingForm;
        if (!form) return;
        await TipsMgr.close(form);
    }
}

export default new WindowMgr();
