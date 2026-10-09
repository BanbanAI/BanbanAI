import { OptionFieldUID } from "@common/types/project";
import { ChartClickState, DefinedOptions, OptionFieldValue, WidgetMetaData } from "@renderer/b2/types";
import { TheWidget as Bubble, component as B2Bubble } from "@renderer/widgets/echarts/bubble";

import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { merge, recursive } from "merge";

export class BubbleShape extends Bubble {
  static resource = recursive(true, Bubble.resource, resource);
  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            children: [
              {
                name: "axis-image",
                visible: true
              },
            ],
          },
        },
        style:{
          "series-shape": {
            children: [
              {
                name: "series-shape-default-cluster",
                children: [
                  {
                    name: "show-bubble",
                    alias: i18next.t("showBubble"),
                    type: "boolean",
                    default: true
                  },
                  {
                    name: "shape-image-percent",
                    visible: true
                  },
                  {
                    name: "shape-show-line",
                    default: true,
                    visible: true
                  }
                ]
              },
            ]
          },
        }
      },
      ...super.defineOptions(),
    ];
  }

  getBase64() {
    let urlDims = this.getOption<OptionFieldValue[]>("axis-image");
    let data = this.datasetSource();
    let promises = [];
    data?.forEach?.(item => {
      if (urlDims?.[0]?.uid[2]) {
        let imageSrc = item?.[urlDims[0].uid[2]];
        let canvas = document.createElement("canvas");
        let img = new Image();
        let dataURL = <any>'';
        img.setAttribute("crossOrigin", "anonymous");
        img.src = imageSrc;
        if(imageSrc) {
          promises.push(new Promise<void>((resolve, reject) => {
            img.onload = (ev) => { //要先确保图片完整获取到，这是个异步事件
              canvas.width = img?.width;
              canvas.height = img?.height;
              canvas.getContext("2d").drawImage(img, 0, 0, img?.width, img?.height); //将图片绘制到canvas中
              dataURL = canvas.toDataURL(`a/png`); //转换图片为dataURL
              canvas.remove();
              this.canvasArr.push(canvas);
              this.imgArr.push("image://" + dataURL);
              resolve();
            }
            img.onerror = () => {
              reject();
            }
          }));
        }
      }
    })
    return Promise.all(promises);
  }

  loadEcharts(echarts){
    this.getBase64().then(res=>{
      this.addEchartsShapes(echarts);
      this.addEchartsDatasetTransform(echarts);
      this.resetChartOption(true);
      this.initEchartsEvents();
    })
  }

  get showImage() {
    return true;
  }

  get showBubble() {
    return this.getOption<boolean>("show-bubble");
  }

  get axisImage() {
    return this.getOption<OptionFieldValue[]>("axis-image") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisX,
        ...this.axisY,
        ...this.axisSize,
        ...this.axisImage
      ]
    } as WidgetMetaData);
  }

  initEchartsEvents(): void {
    const state: ChartClickState = {
      lastseriesIndex: -1,
      lastDataIndex: -1
    };

    this.echartsChart.off("click");
    this.echartsChart.on('click', (params) => {
      this.selectedIndex.value = params.dataIndex;
      this.selectedData.value = {
        name: params.name,
        value: params.value
      }

      // 点击同一个点，取消选中
      if (state.lastDataIndex === params.dataIndex && state.lastseriesIndex === params.seriesIndex) {
        state.lastDataIndex = -1;
        state.lastseriesIndex = -1;
        this.selectedIndex.value = -1;
        this.selectedData.value = null;
        this.withdrawLinkage();
        this.echartsChart.dispatchAction({
          type: 'unselect',
          seriesIndex: params.seriesIndex,
          dataIndex: params.dataIndex
        })
      } else {
        // 取消上一次的选中
        if(state.lastDataIndex !== -1) {
          this.echartsChart.dispatchAction({
            type: 'unselect',
            seriesIndex: state.lastseriesIndex,
            dataIndex: state.lastDataIndex
          })
        }
        state.lastDataIndex = params.dataIndex;
        state.lastseriesIndex = params.seriesIndex;
        this.echartsChart.dispatchAction({
          type: 'select',
          seriesIndex: params.seriesIndex,
          dataIndex: params.dataIndex
        })

        let uids = this.getOption("axis-x")?.[0]?.uid;
        if (uids?.length) {
          let fieldArr = this.getOption<string>("linkage-form-field")?.split(".")
          let fieldUIDs;
          let filterValue;

          if (fieldArr?.length) {
            const rowData = params.data;
            if(rowData){
              if (fieldArr.length === 2) {
                fieldUIDs = [uids[0], ...fieldArr];
                filterValue = rowData[fieldArr[1]];
              } else if (fieldArr.length === 3) {
                fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
                const rawVal = rowData[fieldArr[1]];
                filterValue = Array.isArray(rawVal) ? rawVal.map(item => item[fieldArr[2]]) : rawVal;
              }
            }
          }

          // console.log("bubble-shape", { uid: fieldUIDs as OptionFieldUID, value: filterValue });
          if(fieldUIDs && filterValue !== undefined){
            this.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
          } else {
            let val = params.data?.[uids[2]];
            this.applyLinkage({ uid: uids as OptionFieldUID, value: val !== undefined ? val : params.name });
          }
        }
      }

    })
  }
}
