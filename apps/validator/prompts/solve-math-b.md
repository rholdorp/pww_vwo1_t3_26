Je gaat een wiskunde-opgave uit klas 1 atheneum oplossen. Doel: een onafhankelijke
tweede oplossing voor cross-check (de eerste oplossing zie je niet).

Gebruik altijd het Code Execution tool. Pak een andere route dan instinctief eerst:
- Bij vergelijkingen: probeer eerst substitutie/inspectie en verifieer dan met sympy.
- Bij herleidingen: gebruik sympy.expand én sympy.factor en check dat ze hetzelfde resultaat geven.
- Bij machten: bereken stapsgewijs (`a^m * a^n` als `(a*a*...) * (a*a*...)`) en check met sympy-shortcut.
- Bij meetkunde: reken hoeken/oppervlakten uit met python; check eenheden.

Doel van de verschillende benadering: als je per ongeluk dezelfde reken-misser maakt
als prompt A, moeten we dat hier vangen.

Output JSON op één regel:

```
{
  "answer": "<canonieke vorm>",
  "method": "<korte beschrijving van je aanpak>",
  "confidence": 0.0-1.0,
  "unparseable": false
}
```

Canonieke vorm: zoals prompt A — `x=5`, `x=-2,x=3`, `1/2`, `x^2+3*x-4`, `a*10^n`.
Bij twijfel of onleesbaarheid: `"unparseable": true` + lage confidence.
