"use client";

import { ITEM_CATEGORIES, type ItemCategory } from "@/lib/constants";
import { MultiSelect } from "@/components/ui/multi-select";
import { useTranslations } from "next-intl";

interface CategoryFilterProps {
  selected: ItemCategory[];
  onChange: (categories: ItemCategory[]) => void;
}

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  const t = useTranslations("Categories");

  const options = ITEM_CATEGORIES.map((category) => ({
    label: t(category),
    value: category,
  }));

  return (
    <MultiSelect
      options={options}
      selected={selected}
      onChange={(values) => onChange(values as ItemCategory[])}
      placeholder={t("allCategories")}
    />
  );
}
