import SolidColor from "color";

export type ColorValue = {
  angle: string,
  colors: {
    color: string,
    position: number,
  }[],
};

type ColorStop = {
  color: SolidColor,
  position: number,
  selected?: boolean,
};

export class Color {
  public colors: ColorStop[] = [];
  public angle = "0";
  public selected_index = 0;

  constructor(color: string | ColorValue) {
    if (!color) {
      color = "rgba(255,255,255,255)";
    }
    if (typeof (color) === "string") {
      this.colors = [{ color: new SolidColor(color), position: 1 }];
      this.angle = "0"
    } else if (typeof (color) === "object") {
      this.colors = [];
      for (let i = 0; i < color.colors.length; i++) {
        let color_info = color.colors[i];
        this.colors.push({
          color: new SolidColor(color_info.color),
          position: color_info.position
        });
      }
      this.angle = color.angle || "0";
    }
    this.setSelectedIndex(0);
  }

  isSolid() {
    return this.colors.length === 1;
  }
  isGradient() {
    return this.colors.length > 1;
  }
  isLinearGradient() {
    return this.isGradient() && this.angle !== "r";
  }
  isRadialGradient() {
    return this.isGradient() && this.angle === "r";
  }

  setSelectedIndex(index = 0) {
    this.selected_index = index;
  }

  getSelectedColor() {
    return this.colors[this.selected_index].color;
  }

  getSelectedPosition() {
    return this.colors[this.selected_index].position;
  }

  setSelectedPosition(position) {
    this.colors[this.selected_index].position = position;
  }

  setSelectedColor(color: string | any) {
    if (typeof (color) === "string") {
      this.colors[this.selected_index].color = new SolidColor(color);
    } else {
      this.colors[this.selected_index].color = color;
    }
  }

  getAngle() {
    return this.angle;
  }

  setAngle(angle) {
    this.angle = angle;
  }

  addColor(position: number) {
    //计算color的颜色
    let color = new SolidColor();
    this.colors.push({
      color: color,
      position: position
    });
    this.setSelectedIndex(this.colors.length - 1);
  }

  removeColor(index: number) {
    if (this.colors.length > 1 && index < this.colors.length) {
      this.colors.splice(index, 1);
      this.selected_index = 0;
    }
  }

  hue(hue?: number) {
    if (hue === undefined) {
      return this.getSelectedColor().hue();
    } else {
      let new_color = this.getSelectedColor().hue(hue);
      this.setSelectedColor(new_color);
    }
  }

  saturationv(saturation?: number) {
    if (saturation === undefined) {
      return this.getSelectedColor().saturationv();
    } else {
      let new_color = this.getSelectedColor().saturationv(saturation);
      this.setSelectedColor(new_color);
    }
  }

  value(value?: number) {
    if (value === undefined) {
      return this.getSelectedColor().value();
    } else {
      let new_color = this.getSelectedColor().value(value);
      this.setSelectedColor(new_color);
    }
  }

  red(red?: number): number {
    if (red === undefined) {
      return Math.round(this.getSelectedColor().red());
    } else {
      let new_color = this.getSelectedColor().red(red);
      this.setSelectedColor(new_color);
    }
  }
  green(green?: number) {
    if (green === undefined) {
      return Math.round(this.getSelectedColor().green());
    } else {
      let new_color = this.getSelectedColor().green(green);
      this.setSelectedColor(new_color);
    }
  }
  blue(blue?: number) {
    if (blue === undefined) {
      return Math.round(this.getSelectedColor().blue());
    } else {
      let new_color = this.getSelectedColor().blue(blue);
      this.setSelectedColor(new_color);
    }
  }

  alpha(alpha?: number) {
    if (alpha === undefined) {
      return this.getSelectedColor().alpha();
    } else {
      let new_color = this.getSelectedColor().alpha(alpha);
      this.setSelectedColor(new_color);
    }
  }

  hex(hex?: string) {
    if (hex === undefined) {
      return this.getSelectedColor().hex();
    } else {
      let new_color = new SolidColor(hex);
      this.setSelectedColor(new_color);
    }
  }

  hexa(hexa?: string) {
    if (hexa === undefined) {
      let color = this.getSelectedColor();
      let alpha_hex = Math.round(color.alpha() * 255).toString(16).toUpperCase();
      if (alpha_hex.length < 2) {
        alpha_hex = "0" + alpha_hex;
      }
      return color.hex() + alpha_hex
    } else {
      hexa = hexa.replace(/\s+/g, "").replace(/^#*/, "#");
      let new_color = new SolidColor(hexa);
      this.setSelectedColor(new_color);
    }
  }

  colorStops() {
    //将radial也试做linear来返回
    let colorStops: ColorStop[] = [];
    for (let i = 0; i < this.colors.length; i++) {
      colorStops.push(this.colors[i]);
    }
    colorStops.sort((a, b) => {
      return a.position - b.position;
    });
    return colorStops;
  }

  toCssString(angle?: number): string {
    if (this.isSolid()) {
      return this.getSelectedColor().string();
    } else {
      let stops = this.colorStops().map((value) => {
        return `${value.color.string()} ${value.position}%`;
      });
      if (angle) {
        return `linear-gradient(${angle}deg, ${stops.join(",")})`;
      }

      if (this.isLinearGradient()) {
        return `linear-gradient(${this.angle}deg, ${stops.join(",")})`;
      } else if (this.isRadialGradient()) {
        return `radial-gradient(${stops.join(",")})`;
      }
    }
  }

  toG2String() {
    if (this.isSolid()) {
      return this.getSelectedColor().string().replace(/\s+/g, '');
    } else {
      let stops = this.colorStops().map((value) => {
        return `${value.position / 100}:${value.color.string().replace(/\s+/g, '')}`;
      });
      if (this.isLinearGradient()) {
        return `l(${(parseInt(this.angle) + 270) % 360}) ${stops.join(" ")}`
      } else if (this.isRadialGradient()) {
        return `r(0.5,0.5,0.5) ${stops.join(" ")}`;
      }
    }
  }

  toJSON() {
    let json: ColorValue = {
      angle: this.angle,
      colors: [],
    };
    for (let i = 0; i < this.colors.length; i++) {
      let color_info = this.colors[i];
      json.colors.push({ color: color_info.color.string(), position: color_info.position });
    }
    return json;
  }

  toEchartsColor() {
    if (this.isSolid()) {
      return this.getSelectedColor().string().replace(/\s+/g, "");
    } else {
      //echarts 渐变
      let colorResult = {};
      if (this.isLinearGradient()) {
        //线性渐变
        colorResult["type"] = "linear";
        colorResult["x"] = 0;
        colorResult["y"] = 0;
        colorResult["x2"] = 0;
        colorResult["y2"] = 0;

        let angle = this.getAngle();
        if (angle == "0") {
          colorResult["y"] = 1;
        } else if (angle == "45") {
          colorResult["x2"] = 1;
          colorResult["y2"] = 1;
        } else if (angle == "90") {
          colorResult["x2"] = 1;
        } else if (angle == "135") {
          colorResult["x2"] = 1;
          colorResult["y"] = 1;
        } else if (angle == "180") {
          colorResult["y2"] = 1;
        } else if (angle == "225") {
          colorResult["x"] = 1;
          colorResult["y"] = 1;
        } else if (angle == "270") {
          colorResult["x"] = 1;
        } else if (angle == "315") {
          colorResult["x"] = 1;
          colorResult["y"] = 1;
          colorResult["x2"] = 0;
          colorResult["y2"] = 0;
        }

        colorResult["colorStops"] = this.colorStops().map((colorStop) => {
          return {
            offset: colorStop.position / 100,
            color: colorStop.color.string().replace(/\s+/g, "")
          }
        });
      } else {
        //径向渐变
        colorResult["type"] = "radial";
        colorResult["x"] = 0.5;
        colorResult["y"] = 0.5;
        colorResult["r"] = 0.5;
        colorResult["colorStops"] = this.colorStops().map((colorStop) => {
          return {
            offset: colorStop.position / 100,
            color: colorStop.color.string().replace(/\s+/g, "")
          }
        });
      }
      return colorResult;
    }
  }
}