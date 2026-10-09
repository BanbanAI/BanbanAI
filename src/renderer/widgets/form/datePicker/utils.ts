
import i18next from "@renderer/widgets/i18next";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

export const smartDayjs = (...args: any[]): dayjs.Dayjs => {
  const [date, ...rest] = args;

  if (args.length === 0 || date === undefined) return dayjs();
  if (!date) return dayjs(NaN);

  let processedDate = date;

  if (typeof date === 'string') {
    if (/^\d+$/.test(date)) {
      processedDate = Number(date);
    } else {
      const replacements = [
        [i18next.t("year"), '-'],
        [i18next.t("month"), '-'],
        [i18next.t("day"), ''],
        [i18next.t("hour"), ':'],
        [i18next.t("minute"), ':'],
        [i18next.t("second"), '']
      ];

      processedDate = replacements.reduce((str, [from, to]) =>
        str.replace(new RegExp(from as string, 'g'), to as string), String(date));
    }
  }

  let result = dayjs(processedDate, ...rest);

  if (!result.isValid() && typeof processedDate === 'string' && rest.length === 0) {
    result = dayjs(processedDate, ["MM/YYYY", "MM-YYYY", "MM/DD/YYYY", "MM-DD-YYYY"], true);
  }

  return result.isValid() ? result : dayjs(NaN);
};