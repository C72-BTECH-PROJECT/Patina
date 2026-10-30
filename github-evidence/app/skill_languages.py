"""Resume skill -> GitHub language (T-0012).

Only skills that are programming or markup languages GitHub reports in `/languages` can be checked.
Frameworks, libraries, platforms and tools (react, docker, aws, django ...) are absent on purpose:
they come back as `None` (`not_checkable`) and are never counted against the candidate.

Names on both sides are compared with `normalise`: case, spaces, hyphens, underscores and dots are
ignored, `+` and `#` are kept so that C, C++ and C# stay different.
"""
import re
from typing import Optional

_IGNORED = re.compile(r"[\s\-_.]+")


def normalise(name: str) -> str:
    return _IGNORED.sub("", name).lower()


# GitHub (linguist) language name -> accepted spellings of the skill.
_ALIASES = {
    "Python": ("python", "python3", "py"),
    "JavaScript": ("javascript", "js", "ecmascript", "es6"),
    "TypeScript": ("typescript", "ts"),
    "Java": ("java",),
    "C": ("c", "clang"),
    "C++": ("c++", "cpp", "cplusplus"),
    "C#": ("c#", "csharp"),
    "Go": ("go", "golang"),
    "Rust": ("rust",),
    "Ruby": ("ruby",),
    "PHP": ("php",),
    "Swift": ("swift",),
    "Kotlin": ("kotlin",),
    "Scala": ("scala",),
    "Perl": ("perl",),
    "R": ("r",),
    "Dart": ("dart",),
    "Lua": ("lua",),
    "Shell": ("shell", "bash", "sh", "zsh", "shellscript"),
    "PowerShell": ("powershell", "pwsh"),
    "HTML": ("html", "html5"),
    "CSS": ("css", "css3"),
    "SCSS": ("scss",),
    "MATLAB": ("matlab",),
    "Objective-C": ("objectivec", "objc"),
    "Haskell": ("haskell",),
    "Elixir": ("elixir",),
    "Clojure": ("clojure",),
    "Groovy": ("groovy",),
    "Julia": ("julia",),
    "Dockerfile": ("dockerfile",),
    "Jupyter Notebook": ("jupyternotebook", "ipynb"),
}

_TABLE = {normalise(alias): language for language, aliases in _ALIASES.items() for alias in aliases}
_TABLE.update({normalise(language): language for language in _ALIASES})  # a language name maps to itself


def language_for(skill: str) -> Optional[str]:
    """The GitHub language a skill names, or None when language statistics cannot show it."""
    return _TABLE.get(normalise(skill)) if isinstance(skill, str) else None
