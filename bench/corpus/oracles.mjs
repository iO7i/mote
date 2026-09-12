// Independent expected-value oracle for the accepted pilot. It intentionally
// does not import the reference implementations or their expressions.

export function expected(id, input) {
  switch (id) {
    case "P01": return (input.page - 1) * input.size;
    case "P02": return input.base + (input.override ?? 0);
    case "P03": return input.ok ? input.success : input.fallback;
    case "P04": return input.major * 100 + input.minor;
    case "P05": return input.count <= input.limit;
    case "P06": return input.code + input.message;
    case "P07": return input.authenticated ? input.value : 401;
    case "P08": return input.secret && input.health > 0;
    case "P09": return input.left + input.right;
    case "P10": return input.x * 10 + input.y;
    case "P11": return input.running + input.delta;
    case "P12": return input.cached === 0 ? input.fresh : input.cached;
    case "P13": return input.left - input.right;
    case "P14": return input.enabled ? input.a + input.b : input.a;
    case "P15": return input.value < input.min ? input.min : input.value > input.max ? input.max : input.value;
    case "P16": return input.count + (input.extra ?? 0);
    case "P17": return input.a + input.b + input.c;
    case "P18": return input.enabled ? input.base + input.delta : input.base;
    case "P19": return input.first * input.first + input.second;
    case "P20": return input.a === input.b;
    default: throw new Error(`oracle is not defined for ${id}`);
  }
}

export function checkCase(id, input, actual) {
  return Object.is(expected(id, input), actual);
}
