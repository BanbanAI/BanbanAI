import { DefinedOptions, OptionFontValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { Widget } from "@renderer/b2/controllers/widget";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
export class TimerV2 extends Widget {
  toCssColor(color: Color) {
    return new Color(color).toCssString();
  }
  get timeZoneValue(): string {
    return this.getOption("time-zone");
  }
  get fomatter(): string {
    return this.getOption("time-format");
  }
  get showWeekday(): string {
    return this.getOption("show-weekday");
  }
  get textStyle(): string {
    let fontStyle = this.getOption<OptionFontValue>("font");
    let color = this.toCssColor(fontStyle.color as Color);
    let size = fontStyle.size;
    let family = fontStyle.family;
    let italic = fontStyle.italic ? "italic" : "normal";
    let bold = fontStyle.bold ? "bold" : "normal";
    let spacing = this.getOption("font-spacing")
    let indent = this.getOption("text-indent");
    let textPosition = this.getOption("text-position");
    let textVertical = this.getOption("text-vertical");

    let shadowColor = this.toCssColor(this.getOption("font-shadow-color"));
    let shadowBlur = this.getOption("font-shadow-blur");
    let shadowX = this.getOption("font-shadow-offset-x");
    let shadowY = this.getOption("font-shadow-offset-y");

    let style = `color:transparent;background:${color};background-clip:text;-webkit-background-clip:text;font-size:${size}px;font-style:${italic};letter-spacing: ${spacing}px;font-weight:${bold};
      text-indent:${indent}em;font-family:${family};text-shadow: ${shadowX}px ${shadowY}px ${shadowBlur}px ${shadowColor};`

    let transform = "transform:";
    switch (textVertical) {
      case "top":
        style += `top:0;`
        break;
      case "center":
        style += `top:50%;`
        transform += " translateY(-50%)"
        break;
      case "bottom":
        style += `bottom:0;`
        break;
    }
    switch (textPosition) {
      case "left":
        style += `left:0;`
        break;
      case "center":
        style += `left:50%;`
        transform += " translateX(-50%);"
        break;
      case "right":
        style += `right:0;`
        break;
    }

    return style + transform;
  }

  get customise(): string{
    return this.getOption("time-customise")
  }

  static resource = resource;
  static defineOptions(): DefinedOptions[] {
    return [{
      style: {
        basic: {
          children: [
            {
              name: "time-format",
              alias: i18next.t("timeFormat"),
              type: "select",
              selectChoices:(time:TimerV2)=> time.selectData,
              default: "YYYY-MM-DD HH:mm:ss",
            },
            {
              name: "time-zone",
              alias: i18next.t("timeZone"),
              type: "select",
              default: "Etc/GMT-8",
              selectChoices: [
                {
                  value: "Etc/GMT-12",
                  label: i18next.t("Etc/GMT-12"),
                },
                {
                  value: "Etc/GMT-11",
                  label: i18next.t("Etc/GMT-11"),
                },
                {
                  value: "Etc/GMT-10",
                  label: i18next.t("Etc/GMT-10"),
                },
                {
                  value: "Etc/GMT-9",
                  label: i18next.t("Etc/GMT-9"),
                },
                {
                  value: "Etc/GMT-8",
                  label: i18next.t("Etc/GMT-8"),
                },
                {
                  value: "Etc/GMT-7",
                  label: i18next.t("Etc/GMT-7"),
                },
                {
                  value: "Etc/GMT-6",
                  label: i18next.t("Etc/GMT-6"),
                },
                {
                  value: "Etc/GMT-5",
                  label: i18next.t("Etc/GMT-5"),
                },
                {
                  value: "Etc/GMT-4",
                  label: i18next.t("Etc/GMT-4"),
                },
                {
                  value: "Etc/GMT-3",
                  label: i18next.t("Etc/GMT-3"),
                },
                {
                  value: "Etc/GMT-2",
                  label: i18next.t("Etc/GMT-2"),
                },
                {
                  value: "Etc/GMT-1",
                  label: i18next.t("Etc/GMT-1"),
                },
                {
                  value: "Etc/GMT+0",
                  label: i18next.t("Etc/GMT+0"),
                },
                {
                  value: "Etc/GMT+1",
                  label: i18next.t("Etc/GMT+1"),
                },
                {
                  value: "Etc/GMT+2",
                  label: i18next.t("Etc/GMT+2"),
                },
                {
                  value: "Etc/GMT+3",
                  label: i18next.t("Etc/GMT+3"),
                },
                {
                  value: "Etc/GMT+4",
                  label: i18next.t("Etc/GMT+4"),
                },
                {
                  value: "Etc/GMT+5",
                  label: i18next.t("Etc/GMT+5"),
                },
                {
                  value: "Etc/GMT+6",
                  label: i18next.t("Etc/GMT+6"),
                },
                {
                  value: "Etc/GMT+7",
                  label: i18next.t("Etc/GMT+7"),
                },
                {
                  value: "Etc/GMT+8",
                  label: i18next.t("Etc/GMT+8"),
                },
                {
                  value: "Etc/GMT+9",
                  label: i18next.t("Etc/GMT+9"),
                },
                {
                  value: "Etc/GMT+10",
                  label: i18next.t("Etc/GMT+10"),
                },
                {
                  value: "Etc/GMT+11",
                  label: i18next.t("Etc/GMT+11"),
                },
                {
                  value: "Etc/GMT+12",
                  label: i18next.t("Etc/GMT+12"),
                },
              ],
            },
            {
              name: "time-customise",
              alias: i18next.t("customise"),
              type: "string",
              tip:`格式:YYYY MM DD(${i18next.t("year")}${i18next.t("month")}${i18next.t("day")}) HH mm ss(${i18next.t("hours")}${i18next.t("minutes")}${i18next.t("time")})`,
              default: "",
              visible:(widget)=>{
                return widget.getOption("time-format") === "customise"
              }
            },
            {
              name: "show-weekday",
              alias: i18next.t("showWeekday"),
              type: "boolean",
              default: false
            }
          ],
        },
        font: {
          alias: i18next.t("fontSetting"),
          children: [
            {
              name: "font",
              alias: i18next.t("font"),
              type: "font(gradient=true)",
              default: {
                color: "#ededed",
                family: 'sans-serif',
                size: 30,
                bold: false,
                italic: false,
                underline: false,
                "line-through": false
              },
            },
            {
              name: "font-spacing",
              alias: i18next.t("fontSpacing"),
              default: 0,
              type: "number(unit=px)",
            },
            {
              name: "text-indent",
              alias: i18next.t("fontIndent"),
              type: "number(unit=px)",
              default: 0,
            },
            {
              name: "text-position",
              alias: i18next.t("fontAlign"),
              type: "select(radioGroup)",
              default: "center",
              selectChoices: [
                {
                  label: i18next.t("left"),
                  value: "left"
                },
                {
                  label: i18next.t("center"),
                  value: "center"
                },
                {
                  label: i18next.t("right"),
                  value: "right"
                },
              ],
            },
            {
              name: "text-vertical",
              alias: i18next.t("verticalAlign"),
              type: "select(radioGroup)",
              default: "center",
              selectChoices: [
                {
                  label: i18next.t("top"),
                  value: "top"
                },
                {
                  label: i18next.t("center"),
                  value: "center"
                },
                {
                  label: i18next.t("bottom"),
                  value: "bottom"
                },
              ],
            },
            {
              name: "shadow-cluster",
              alias: i18next.t("fontShadow"),
              children: [
                {
                  name: "font-shadow-color",
                  alias: i18next.t("fontShadowColor"),
                  type: "color(gradient)",
                  default: "#ffffff",
                },
                {
                  name: "font-shadow-blur",
                  alias: i18next.t("fontShadowBlur"),
                  type: "number(unit=px)",
                  default: -1,
                },
                {
                  name: "font-shadow-offset-x",
                  alias: i18next.t("fontShadowOffsetX"),
                  type: "number(unit=px)",
                  default: 0,
                },
                {
                  name: "font-shadow-offset-y",
                  alias: i18next.t("fontShadowOffsetY"),
                  type: "number(unit=px)",
                  default: 0,
                },
              ]
            }
          ]
        }
      },
    }, ...super.defineOptions()];
  }
  get selectData(){
    let timeDate = new Date()
    const customise = i18next.t("customise");
    const yearUnit = i18next.t("year");
    const monthUnit = i18next.t("month");
    const dayUnit = i18next.t("day");
    const hoursUnit = i18next.t("hours");
    const minutesUnit = i18next.t("minutes");
    const secondsUnit = i18next.t("time");

    const fullYear = timeDate.getFullYear();
    const month = timeDate.getMonth() + 1;
    const day = timeDate.getDate();
    const hours = timeDate.getHours();
    const minutes = timeDate.getMinutes();
    const seconds = timeDate.getSeconds();
    return [
      {
        label: `${fullYear}-${month}-${day} ${hours}:${minutes}:${seconds}`,
        value:"YYYY-MM-DD HH:mm:ss"
      },
      {
        label:`${fullYear}${yearUnit}${month}${monthUnit}${day}${dayUnit}`,
        value:"YYYY年MM月DD日"
      },
      {
        label:`${fullYear}${yearUnit}${month}${monthUnit}`,
        value:"YYYY年MM月"
      },
      {
        label:`${fullYear}${yearUnit}`,
        value:"YYYY年"
      },
      {
        label:`${month}${monthUnit}`,
        value:"MM月"
      },
      {
        label:`${day}${dayUnit}`,
        value:"DD日"
      },
      {
        label:`${hours}:${minutes}:${seconds}`,
        value:"HH:mm:ss"
      },
      {
        label:`${minutes}${minutesUnit}${seconds}${secondsUnit}`,
        value:"mm分ss秒"
      },
      {
        label:`${seconds}${secondsUnit}`,
        value:"ss秒"
      },
      {
        label:customise,
        value:"customise"
      }
    ]
  }

}