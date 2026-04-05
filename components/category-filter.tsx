"use client";

import { ITEM_CATEGORIES, type ItemCategory } from "@/lib/constants";
import { MultiSelect } from "@/components/ui/multi-select";
import { useTranslations } from "next-intl";

interface CategoryFilterProps {
  selected: ItemCategory[];
  onChange: (categories: ItemCategory[]) => void;
  className?: string;
}

export function CategoryFilter({
  selected,
  onChange,
  className,
}: CategoryFilterProps) {
  const t = useTranslations("Categories");

  const options = ITEM_CATEGORIES.map((category) => ({
    label: t(category),
    value: category,
  }));

  return (
    <MultiSelect
      options={options}
      defaultValue={selected}
      onValueChange={(values) => onChange(values as ItemCategory[])}
      placeholder={t("allCategories")}
      singleLine={true}
      animation={0}
      hideSelectAll={false}
      closeOnSelect={false}
      className={className}
    />
  );
}
