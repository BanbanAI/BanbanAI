
export type MenuItem = {
  label: string;
  id: string;
  value: string;
  color?: string;
};

export type MenuItemOptions = {
  checkedValue?: string | string[];
  isColored: boolean;
  options: MenuItem[];
  otherOptions?: { id: string; value: string };
};