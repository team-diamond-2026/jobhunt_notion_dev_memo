"use client";

import { useState } from "react";
import {
  INDUSTRY_CATEGORIES,
  INDUSTRY_CATEGORY_OTHER,
} from "./industry";

type IndustryFieldsProps = {
  initialCategory?: string;
  initialOther?: string;
};

export function IndustryFields({
  initialCategory = "",
  initialOther = "",
}: IndustryFieldsProps) {
  const [category, setCategory] = useState(initialCategory);

  return (
    <div className="space-y-3">
      <input type="hidden" name="industry_category_required" value="true" />
      <div>
        <label
          htmlFor="industry_category"
          className="block text-sm font-medium text-slate-700"
        >
          業界カテゴリ *
        </label>
        <select
          id="industry_category"
          name="industry_category"
          required
          aria-describedby="industry-category-help"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="ui-field"
        >
          <option value="">選択してください</option>
          {INDUSTRY_CATEGORIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <p id="industry-category-help" className="mt-1 text-sm text-slate-600">
          該当する業界がない場合は「その他」を選択してください。
        </p>
      </div>

      <div className={category === INDUSTRY_CATEGORY_OTHER ? "" : "hidden"}>
        <label
          htmlFor="industry_other"
          className="block text-sm font-medium text-slate-700"
        >
          業界名を入力
        </label>
        <input
          id="industry_other"
          name="industry_other"
          type="text"
          required={category === INDUSTRY_CATEGORY_OTHER}
          disabled={category !== INDUSTRY_CATEGORY_OTHER}
          defaultValue={initialOther}
          placeholder="例: エンタメ"
          className="ui-field"
        />
      </div>
    </div>
  );
}
