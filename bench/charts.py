"""Render README figures from the recorded benchmark results. Requires matplotlib."""
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / "bench/results.json").read_text(encoding="utf-8"))
OUT = ROOT / "docs/images"
OUT.mkdir(parents=True, exist_ok=True)
NAVY, TEAL, GRAY, CORAL = "#172B4D", "#087F8C", "#DCE4EE", "#CB714B"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 11,
                    "text.color": NAVY, "axes.labelcolor": NAVY,
                    "xtick.color": "#52647A", "ytick.color": NAVY,
                    "axes.spines.top": False, "axes.spines.right": False,
                    "axes.spines.left": False, "axes.spines.bottom": False,
                    "svg.fonttype": "path", "savefig.facecolor": "#FFFFFF"})

def save(fig, name):
    fig.savefig(OUT / f"{name}.svg", bbox_inches="tight", pad_inches=.3)
    fig.savefig(OUT / f"{name}.png", dpi=180, bbox_inches="tight", pad_inches=.3)
    plt.close(fig)

verified = [r for r in data["perTokenizer"] if r["status"] == "VERIFIED"]
assert len(verified) == 3 and data["tasksMeasured"] == 5
fig, ax = plt.subplots(figsize=(10.5, 4.5))
fig.subplots_adjust(top=.73, bottom=.22, left=.24, right=.94)
fig.text(.035, .96, "MOTE  /  BENCHMARKS", fontsize=10, color=TEAL, weight="bold")
fig.text(.035, .865, "Code-token reduction across tokenizers", fontsize=22, weight="bold")
fig.text(.035, .795, "Median across five synthetic tasks · extracted code, Mote vs TypeScript (C vs A)", fontsize=10.5)
labels = ["OpenAI o200k_base", "Llama 3", "DeepSeek V3"]
vals = [r["code_saving_median"] for r in verified]
ax.barh(labels, [100]*3, height=.42, color="#F0F4F8")
bars = ax.barh(labels, vals, height=.42, color=TEAL)
for bar, v in zip(bars, vals):
    ax.text(v + 2, bar.get_y()+bar.get_height()/2, f"{v:.1f}%", va="center", weight="bold", fontsize=13)
ax.set_xlim(0, 100); ax.invert_yaxis()
ax.set_xticks([0,25,50,75,100], ["0%","25%","50%","75%","100%"])
ax.tick_params(axis="both", length=0, pad=10)
ax.set_axisbelow(True); ax.grid(axis="x", color="#E8EDF3", linewidth=.7)
fig.text(.035,.08,"Source: bench/results.json · Manual fixtures; runtime and workflow overhead excluded.",fontsize=9,color="#52647A")
fig.text(.035,.035,"Token reduction does not establish lower session cost or better output quality.",fontsize=9,color="#52647A")
save(fig,"tokenizer-savings")

tasks=data["tasks"]
names=[t["task"].split("-",1)[1].replace("-"," ").title() for t in tasks]
names=[n.replace("Api", "API").replace("Csv", "CSV") for n in names]
ts=[t["sizes"]["ts_source_tokens"] for t in tasks]
mote=[t["sizes"]["mote_source_tokens"] for t in tasks]
cold=[t["sizes"]["cold_start"]["mote"] for t in tasks]
fig, axes=plt.subplots(1,2,figsize=(12,5.7),sharey=True)
fig.subplots_adjust(top=.69,bottom=.22,left=.16,right=.96,wspace=.20)
fig.text(.035,.96,"MOTE  /  SOURCE & RUNTIME",fontsize=10,color=TEAL,weight="bold")
fig.text(.035,.875,"Compact source. A real runtime cost.",fontsize=23,weight="bold")
fig.text(.035,.807,"Full-source comparison · OpenAI o200k_base · five synthetic tasks",fontsize=11)
y=np.arange(len(tasks))
maximum=max(cold+ts)*1.22
for ax, values, title, color in [(axes[0],mote,"SOURCE ONLY",TEAL),(axes[1],cold,"SOURCE + SHARED RUNTIME, ONE MODULE",CORAL)]:
    ax.barh(y-.17,ts,height=.28,color=GRAY,label="Strict TypeScript")
    ax.barh(y+.17,values,height=.28,color=color,label="Mote")
    for i,(a,b) in enumerate(zip(ts,values)):
        ax.text(a+20,i-.17,f"{a:,}",va="center",fontsize=8.5)
        ax.text(b+20,i+.17,f"{b:,}",va="center",fontsize=8.5,color=color,weight="bold")
    ax.set_title(title,loc="left",fontsize=9,weight="bold",pad=15)
    ax.set_xlim(0,maximum);ax.set_xlabel("Tokens",fontsize=9)
    ax.set_axisbelow(True);ax.grid(axis="x",color="#E8EDF3",linewidth=.7)
    ax.tick_params(axis="both",length=0,pad=7)
axes[0].set_yticks(y,names);axes[0].invert_yaxis()
for ax in axes:
    ax.legend(loc="upper left",bbox_to_anchor=(0,-.17),frameon=False,ncol=2,fontsize=9)
fig.text(.035,.075,f"The {data['runtimeSharedTokens']:,}-token shared runtime is counted once in the right panel; it can be amortized across modules.",fontsize=9,color="#52647A")
fig.text(.035,.03,"Strict TypeScript includes validation. Its helpers are counted per file. These results do not measure end-to-end cost.",fontsize=9,color="#52647A")
save(fig,"source-runtime")
