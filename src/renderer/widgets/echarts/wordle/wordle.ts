import { DefinedOptions, OptionFileValue, OptionFieldValue, WidgetMetaData } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID } from "@common/types/project";
import { OptionFontValue } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";

import { formatFloat } from "@common/utils/math";
import { TheWidget as Echarts } from "@renderer/widgets/echarts/basic";
import { TooltipComponentOption, XAXisComponentOption, YAXisComponentOption, SeriesOption } from "echarts/dist/echarts";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { merge, recursive } from "merge";
import { ref, watch } from "vue";

export class Wordle extends Echarts {
  public maskImage: any;
  static resource = recursive(true, Echarts.resource, resource);

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_name", alias: "词名", type: "string" },
        { uid: "f_value", alias: "词频", type: "number" },
      ],
      rows: [
        { f_name: "China", f_value: 1383220000 },
        { f_name: "India", f_value: 1316000000 },
        { f_name: "United States", f_value: 324982000 },
        { f_name: "Indonesia", f_value: 263510000 },
        { f_name: "Brazil", f_value: 207505000 },
        { f_name: "Pakistan", f_value: 196459000 },
        { f_name: "Nigeria", f_value: 191836000 },
        { f_name: "Tanzania", f_value: 56878000 },
        { f_name: "South Africa", f_value: 55908000 },
        { f_name: "Myanmar", f_value: 54836000 },
        { f_name: "South Korea", f_value: 51446201 },
        { f_name: "Colombia", f_value: 49224700 },
        { f_name: "Kenya", f_value: 48467000 },
        { f_name: "Spain", f_value: 46812000 },
        { f_name: "Argentina", f_value: 43850000 },
        { f_name: "Ukraine", f_value: 42541633 },
        { f_name: "Sudan", f_value: 42176000 },
        { f_name: "Uganda", f_value: 41653000 },
        { f_name: "Algeria", f_value: 41064000 },
        { f_name: "Poland", f_value: 38424000 },
        { f_name: "Iraq", f_value: 37883543 },
        { f_name: "Canada", f_value: 36541000 },
        { f_name: "Morocco", f_value: 34317500 },
        { f_name: "Saudi Arabia", f_value: 33710021 },
        { f_name: "Uzbekistan", f_value: 32121000 },
        { f_name: "Malaysia", f_value: 32063200 },
        { f_name: "Peru", f_value: 31826018 },
        { f_name: "Venezuela", f_value: 31431164 },
        { f_name: "Mali", f_value: 18875000 },
        { f_name: "Malawi", f_value: 18299000 },
        { f_name: "Chile", f_value: 18191900 },
        { f_name: "Kazakhstan", f_value: 17975800 },
        { f_name: "Cuba", f_value: 11239004 },
        { f_name: "Bolivia", f_value: 11145770 },
        { f_name: "Somalia", f_value: 11079000 },
        { f_name: "Haiti", f_value: 11078033 },
        { f_name: "Greece", f_value: 10783748 },
        { f_name: "Benin", f_value: 10653654 },
        { f_name: "Czech Republic", f_value: 10578820 },
        { f_name: "Portugal", f_value: 10341330 },
        { f_name: "Burundi", f_value: 10114505 },
        { f_name: "Dominican Republic", f_value: 10075045 },
        { f_name: "Israel", f_value: 8690220 },
        { f_name: "Switzerland", f_value: 8417700 },
        { f_name: "Papua New Guinea", f_value: 8151300 },
      ],
    };
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fields"),
            children: [
              {
                name: "axis-words",
                alias: i18next.t("axis-words"),
                type: "field(recommend=string)",
                default: [{ summary: "", uid: [PrivateDataConnectionUID, PrivateDataTableUID, "f_name"], __opt_type: "field" }]
              },
              {
                name: "axis-freq",
                alias: i18next.t("axis-freq"),
                type: "field",
                default: [{ summary: "", uid: [PrivateDataConnectionUID, PrivateDataTableUID, "f_value"], __opt_type: "field" }]
              },
              {
                name: "axis-fields",
                visible: false
              }
            ],
          },
        },
        style: {
          basic: {
            alias: i18next.t("basic"),
            children: [
              {
                name: "max-words",
                alias: i18next.t("max-words"),
                type: "number(unit=" + i18next.t("unitGe") + ")",
                default: 100,
              },
              {
                name: "sampling-rate",
                alias: i18next.t("sampling-rate"),
                type: "number(unit=%)",
                default: 100,
                visible: false,
              },
            ],
          },
          "label-group": {
            default: false,
            visible: false,
          },
          sort: {
            visible: false,
          },
          legend: {
            alias: i18next.t("legend"),
            type: "boolean",
            default: false,
            visible: false,
          },
          "series-shape": {
            alias: i18next.t("series-shape"),
            children: [
              {
                name: "series-shape-contour-image",
                alias: i18next.t("series-shape-contour-image"),
                type: "file(format=image)",
                default: "",
              },
            ],
          },
          font: {
            alias: i18next.t("font"),
            children: [
              {
                name: "min-font-size",
                alias: i18next.t("min-font-size"),
                default: 15,
                type: "number(unit=px)",
              },
              {
                name: "max-font-size",
                alias: i18next.t("max-font-size"),
                default: 50,
                type: "number(unit=px)",
              },
              {
                name: "font-spacing",
                alias: i18next.t("font-spacing"),
                default: 10,
                type: "number(unit=px)",
              },
              {
                name: "font-size",
                visible: false,
              },
              {
                name: "text-indent",
                visible: false,
              },
            ],
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  get echartsXAxisOption(): XAXisComponentOption {
    return {
      show: false,
    };
  }

  get echartsYAxisOption(): YAXisComponentOption {
    return {
      show: false,
    };
  }

  get echartsTooltipOption():
    | TooltipComponentOption
    | TooltipComponentOption[] {
    let backgroundColor = new Color(
      this.getOption<Color>("tooltip-background-color")
    ).toCssString();
    let backgroundImage = this.getOption<OptionFileValue>(
      "tooltip-background-image"
    );
    let paddingWidth = this.getOption<number>("tooltip-padding-width");
    let paddingHeight = this.getOption<number>("tooltip-padding-height");
    let radius = this.getOption<number>("tooltip-radius");
    let showIcon = this.getOption<boolean>("tooltip-icon");
    let commaDisplay = this.getOption<boolean>("tooltip-comma-display")
    let nameFontColor = new Color(
      this.getOption<Color>("tooltip-name-font-color")
    ).hexa();
    let nameFontSize = this.getOption<number>("tooltip-name-font-size");
    let valueFontColor = new Color(
      this.getOption<Color>("tooltip-value-font-color")
    ).hexa();
    let valueFontSize = this.getOption<number>("tooltip-value-font-size");
    let showTitle = this.getOption<boolean>("tooltip-title");
    let titleFontColor = new Color(
      this.getOption<Color>("tooltip-title-font-color")
    ).hexa();
    let titleFontSize = this.getOption<number>("tooltip-title-font-size");

    let tooltipValueType = this.getOption<string>("tooltip-text-type");
    let tooltipValueDecimalPlaces = this.getOption<number>(
      "tooltip-decimal-places"
    );
    let tooltipValueCompleteZero = this.getOption<boolean>(
      "tooltip-complete-zero"
    );

    const projectId = this.getBoard().projectId;
    const seriesCssColors = this.getSeriesCssColors();
    let showTooltip = this.getOption<boolean>("tooltip");
    let tooltipBackground = backgroundImage?.relativePath
      ? `url("${projectId}/${backgroundImage.relativePath}")`
      : backgroundColor;
    let backgroundBlur = this.getOption<OptionFileValue>("tooltip-background-blur");
    return {
      trigger: "item",
      confine: true,
      show: showTooltip,
      borderWidth: 0,
      padding: [paddingHeight, paddingWidth, paddingHeight, paddingWidth],
      extraCssText: `
        background: ${tooltipBackground};
        background-size: 100% 100%;
        background-repeat: no-repeat;
        background-position: center center;
        border-radius: ${radius}px;
        backdrop-filter: blur(${backgroundBlur}px);
        z-index:0;
      `,
      formatter: (param) => {
        let dataHtml = "";
        let iconHtml = showIcon ? `<span style="color:red;display:inline-block;width:10px;height:10px;border-radius:50%;background:${param.color};"></span>` : "";
        let resultValue: any = param.value;
        if (isNaN(resultValue)) resultValue = 0;
        resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero);
        if(commaDisplay){
          resultValue = this.doCommaSeparat(resultValue)
        }
        dataHtml += `<div>${iconHtml}
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.name}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${resultValue}</span>
        </div>`;
        let titleHtml = showTitle ? `<div><span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${param.seriesName}</span></div>` : "";
        return `<div>${titleHtml}<div>${dataHtml}</div></div>`;
      },
    };
  }

  checkErrorData() {
    let dataOpt = this.getOption<OptionFieldValue[]>("axis-words") || [];
    let dataValue = this.getOption<OptionFieldValue[]>("axis-freq") || [];
    if(!dataOpt.length && !dataValue.length) {
      this.addErrorDataStatus("filed-empty");
    } else {
      this.clearErrorDataStatus();
    }
  }
  _datasetSource() {
    let data = this.createView(["axis-words", "axis-freq"]);
    if ([...this.axisWords, ...this.axisFreq]?.every(option => option.uid?.[2]?.split(".")?.length > 1)) {
      data = this.flatDataset(data, [this.axisWords[0].uid[2], this.axisFreq[0].uid[2]]);
    }
    return data;
  }

  getWordleData() {
    let resultData = [];
    let maxWords = this.getOption<number>('max-words')
    let dataOpt = this.getOption<OptionFieldValue[]>("axis-words") || [];
    let dataValue = this.getOption<OptionFieldValue[]>("axis-freq") || [];
    if(!dataValue.length && dataOpt.length) {
      let treeMapData = this.datasetSource();
      let uid = dataOpt[0].uid[2];
      let wordMap = {};
      treeMapData.forEach(row => {
        let value = row[uid];
        if(Array.isArray(value) && value.length) {
          value.forEach(val => {
            if(!wordMap[val]) {
              wordMap[val] = 0;
            }
            wordMap[val]++;
          });
        } else {
          if(!wordMap[value]) {
            wordMap[value] = 0;
          }
          wordMap[value]++;
        }
      });

      for(let key in wordMap) {
        let dataInfo = {};
        dataInfo["name"] = key;
        dataInfo["value"] = wordMap[key];
        resultData.push(dataInfo);
      }


    } else if (!dataOpt.length || !dataValue.length) {
      resultData = this.getPrivateData().rows;
    } else {
      let treeMapData = this.datasetSource();
      for (let row of treeMapData) {
        let dataInfo = {};
        dataInfo["name"] = row[dataOpt[0]?.uid[2]];
        dataInfo["value"] = row[dataValue[0]?.uid[2]];
        resultData.push(dataInfo);
      }
    }
    let temp = resultData.filter((item, index) => {
      return index < maxWords
    });
    return temp;
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] | any {
    this.maskImage = new Image();
    let colors = this.getOption<Color[]>("palette");
    for (let index in colors) {
      colors[index] = this.toEchartsColor(colors[index]);
    }
    let wordleImag = this.getOption<OptionFileValue>("series-shape-contour-image")?.relativePath || "";
    let url: string = "";
    if (wordleImag) {
      const projectId = this.getBoard().projectId;
      url = `${projectId}/${wordleImag}`;
    }
    this.maskImage.src = url;
    let num = -1;
    if (url) {
      return [
        {
          type: "wordCloud",
          gridSize: this.getOption<number>("font-spacing"),
          shape: "circle",
          sizeRange: [
            this.getOption<number>("min-font-size"),
            this.getOption<number>("max-font-size"),
          ],
          rotationRange: [0, 90],
          rotationStep: 90,
          maskImage: this.maskImage,
          left: "center",
          top: "center",
          width: "90%",
          height: "90%",
          drawOutOfBound: false,
          shrinkToFit: true,
          textStyle: {
            color: function (v) {
              if (num === colors.length - 1) {
                num = -1;
              }
              num++;
              return colors[num];
            },
          },
          emphasis: {
            textStyle: {
              textShadowBlur: 10,
              textShadowColor: "#2ac",
            },
          } as any,
          data: this.getWordleData(),
        },
      ];
    } else {
      return [
        {
          type: "wordCloud",
          gridSize: this.getOption<number>("font-spacing"),
          shape: "circle",
          sizeRange: [
            this.getOption<number>("min-font-size"),
            this.getOption<number>("max-font-size"),
          ],
          rotationRange: [0, 90],
          rotationStep: 90,
          left: "center",
          top: "center",
          width: "90%",
          height: "90%",
          drawOutOfBound: true,
          shrinkToFit: true,
          textStyle: {
            color: function(v) {
              if (num === colors.length - 1) {
                num = -1;
              }
              num++;
              return colors[num];
            },
          },
          emphasis: {
            textStyle: {
              textShadowBlur: 10,
              textShadowColor: "#2ac",
            },
          } as any,
          data: this.getWordleData(),
        },
      ];
    }
  }

  get axisWords() {
    return this.getOption<OptionFieldValue[]>("axis-words") || [];
  }

  get axisFreq() {
    return this.getOption<OptionFieldValue[]>("axis-freq") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisWords,
        ...this.axisFreq,
      ]
    } as WidgetMetaData);
  }

  //this.maskImage.onload有点问题
  // resetChartOption() {
  //   this.maskImage.onload = ()=>{
  //     this.echartsChart.setOption(this.echartsOption);
  //   }
  // }
}
