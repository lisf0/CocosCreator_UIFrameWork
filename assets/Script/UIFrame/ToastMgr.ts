import * as cc from "cc";

import { Pool } from "../Common/Utils/Pool";
import { FormType } from "./config/SysDefine";
import { EventCenter } from "./EventCenter";
import ResMgr from "./ResMgr";
import { GetForm, IFormConfig, IFormData } from "./Struct";
import { UIToastBase } from "./UIForm";
import UIManager from "./UIManager";

class ToastMgr {
    private _pools: { [key: string]: Pool<UIToastBase | null> | null } = cc.js.createMap();
    private _showingToast: { [key: string]: Array<UIToastBase | null> | null } = cc.js.createMap();

    public async open(
        form: IFormConfig | string,
        params?: any,
        formData?: IFormData
    ) {
        form = GetForm(form, FormType.Toast);

        const bundleName = form.bundleName;
        const prefabUrl = form.prefabUrl;
        const fid = `${bundleName}-${prefabUrl}`;

        let pool = this._pools[fid];

        if (!pool) {
            pool = await this.genPool(bundleName, prefabUrl);
        }
        let toastBase = pool.alloc();
        if (toastBase == null) {
            return null;
        }
        await UIManager.getInstance().enterToToast(toastBase, params);

        let arr = this._showingToast[fid];
        if (!arr) {
            arr = this._showingToast[fid] = new Array<UIToastBase>();
        }
        arr.push(toastBase);

        return toastBase;
    }

    public async close(com: UIToastBase, params?: any) {
        await UIManager.getInstance().exitToToast(com, params);
        console.log(com.fid);
        if (!this._pools[com.fid]) return;
        this._pools[com.fid]?.free(com);

        let arr = this._showingToast[com.fid];
        if (!arr) return;
        for (let i = arr.length - 1; i >= 0; i--) {
            if (arr[i] == null || arr[i]?.uuid !== com.uuid) continue;
            arr.splice(i, 1);
            break;
        }
    }


    private async genPool(bundleName: string, prefabUrl: string) {
        const fid = `${bundleName}-${prefabUrl}`;
        // 对pool创建一个独立结点
        // todo...
        let prefab = await ResMgr.inst.loadFormPrefab(bundleName, prefabUrl);

        let pool = this._pools[fid] = new Pool(() => {
            if (prefab) {
                let node = cc.instantiate(prefab);
                if (node == null) {
                    return null;
                }
                UIManager.getInstance().addNode(node);
                let com = node.getComponent(UIToastBase);
                if (com) {
                    com.fid = fid;
                }

                return com;
            }
            return null;
        }, 3);
        return pool;
    }

    public clearToasts(bundleName: string, prefabUrl: string) {
        const fid = `${bundleName}-${prefabUrl}`;
        let pool = this._pools[fid];
        if (!pool) return;

        // 先清理可能没有收入到pool中的
        let arr = this._showingToast[fid];
        if (!arr) return;

        for (let toast of arr) {
            pool.free(toast);
        }

        pool.clear((toastBase: UIToastBase | null) => {
            if (toastBase) {
                toastBase.node.destroy();
                EventCenter.targetOff(toastBase);
            }
        });
        // 销毁prefab以及依赖的资源
        ResMgr.inst.destoryFormPrefab(fid);

        this._pools[fid] = null;
        delete this._pools[fid];

        this._showingToast[fid] = null;
        delete this._showingToast[fid];
    }


    public checkHasShowingToast(bundleName: string, prefabUrl: string) {
        const fid = `${bundleName}-${prefabUrl}`;
        return this._showingToast[fid] && this._showingToast[fid].length > 0;
    }

}

export default new ToastMgr();

