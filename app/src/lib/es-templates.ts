import type { EsDocumentType } from "./es";

export type EsDraftValues = {
  company_id: string;
  title: string;
  doc_type: string;
  content: string;
};

export type EsCreateState = {
  attempt: number;
  error: string;
  values: EsDraftValues;
} | undefined;

type EsTemplate = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly doc_type: EsDocumentType;
  readonly title: string;
  readonly content: string;
};

// Built-in writing prompts. Saving an ES copies strings, never edits this source.
export const ES_TEMPLATES = [
  {
    id: "self_pr",
    name: "自己PR",
    description: "強みと具体的な経験を結びつけ、入社後の貢献を整理します。",
    doc_type: "self_pr",
    title: "自己PRの下書き",
    content: "【私の強み】\n強みを一言で書いてください。\n\n【強みを発揮した経験】\n状況・課題と、あなた自身が考えて行動したことを書いてください。\n\n【結果と学び】\n結果を具体的に示し、経験から学んだことを書いてください。\n\n【入社後の貢献】\n応募先でこの強みをどう生かすかを書いてください。",
  },
  {
    id: "gakuchika",
    name: "ガクチカ",
    description: "学生時代の取り組みを、課題・行動・結果の順で整理します。",
    doc_type: "gakuchika",
    title: "ガクチカの下書き",
    content: "【力を入れたこと】\n学生時代に最も力を入れた取り組みを書いてください。\n\n【目標と課題】\n目標、取り組んだ理由、直面した課題を書いてください。\n\n【自分の行動と工夫】\n自分の役割と、課題に対して実際に行った工夫を書いてください。\n\n【結果と学び】\n成果と、今後も生かせる学びを書いてください。",
  },
  {
    id: "motivation",
    name: "志望動機",
    description: "企業を選んだ理由と、自分の経験・実現したいことをつなげます。",
    doc_type: "motivation",
    title: "志望動機の下書き",
    content: "【実現したいこと】\n仕事を通じて実現したいことを書いてください。\n\n【関心を持ったきっかけ】\n自分の経験と、業界や仕事への関心がつながる点を書いてください。\n\n【この企業を選ぶ理由】\n調べた事業・仕事内容などをもとに、この企業ならではの理由を書いてください。\n\n【入社後に取り組みたいこと】\n自分の強みや経験を生かして、どう貢献したいかを書いてください。",
  },
] as const satisfies readonly EsTemplate[];

export function getEsTemplate(id: string | undefined) {
  return ES_TEMPLATES.find((template) => template.id === id);
}
