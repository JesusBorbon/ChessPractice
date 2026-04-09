var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/chess.js/dist/esm/chess.js
function rootNode(comment) {
  return comment !== null ? { comment, variations: [] } : { variations: [] };
}
function node(move, suffix, nag, comment, variations) {
  const node2 = { move, variations };
  if (suffix) {
    node2.suffix = suffix;
  }
  if (nag) {
    node2.nag = nag;
  }
  if (comment !== null) {
    node2.comment = comment;
  }
  return node2;
}
function lineToTree(...nodes) {
  const [root, ...rest] = nodes;
  let parent = root;
  for (const child of rest) {
    if (child !== null) {
      parent.variations = [child, ...child.variations];
      child.variations = [];
      parent = child;
    }
  }
  return root;
}
function pgn(headers, game) {
  if (game.marker && game.marker.comment) {
    let node2 = game.root;
    while (true) {
      const next = node2.variations[0];
      if (!next) {
        node2.comment = game.marker.comment;
        break;
      }
      node2 = next;
    }
  }
  return {
    headers,
    root: game.root,
    result: (game.marker && game.marker.result) ?? void 0
  };
}
function peg$subclass(child, parent) {
  function C() {
    this.constructor = child;
  }
  C.prototype = parent.prototype;
  child.prototype = new C();
}
function peg$SyntaxError(message, expected, found, location2) {
  var self2 = Error.call(this, message);
  if (Object.setPrototypeOf) {
    Object.setPrototypeOf(self2, peg$SyntaxError.prototype);
  }
  self2.expected = expected;
  self2.found = found;
  self2.location = location2;
  self2.name = "SyntaxError";
  return self2;
}
function peg$padEnd(str, targetLength, padString) {
  padString = padString || " ";
  if (str.length > targetLength) {
    return str;
  }
  targetLength -= str.length;
  padString += padString.repeat(targetLength);
  return str + padString.slice(0, targetLength);
}
function peg$parse(input, options) {
  options = options !== void 0 ? options : {};
  var peg$FAILED = {};
  var peg$source = options.grammarSource;
  var peg$startRuleFunctions = { pgn: peg$parsepgn };
  var peg$startRuleFunction = peg$parsepgn;
  var peg$c0 = "[";
  var peg$c1 = '"';
  var peg$c2 = "]";
  var peg$c3 = ".";
  var peg$c4 = "O-O-O";
  var peg$c5 = "O-O";
  var peg$c6 = "0-0-0";
  var peg$c7 = "0-0";
  var peg$c8 = "$";
  var peg$c9 = "{";
  var peg$c10 = "}";
  var peg$c11 = ";";
  var peg$c12 = "(";
  var peg$c13 = ")";
  var peg$c14 = "1-0";
  var peg$c15 = "0-1";
  var peg$c16 = "1/2-1/2";
  var peg$c17 = "*";
  var peg$r0 = /^[a-zA-Z]/;
  var peg$r1 = /^[^"]/;
  var peg$r2 = /^[0-9]/;
  var peg$r3 = /^[.]/;
  var peg$r4 = /^[a-zA-Z1-8\-=]/;
  var peg$r5 = /^[+#]/;
  var peg$r6 = /^[!?]/;
  var peg$r7 = /^[^}]/;
  var peg$r8 = /^[^\r\n]/;
  var peg$r9 = /^[ \t\r\n]/;
  var peg$e0 = peg$otherExpectation("tag pair");
  var peg$e1 = peg$literalExpectation("[", false);
  var peg$e2 = peg$literalExpectation('"', false);
  var peg$e3 = peg$literalExpectation("]", false);
  var peg$e4 = peg$otherExpectation("tag name");
  var peg$e5 = peg$classExpectation([["a", "z"], ["A", "Z"]], false, false);
  var peg$e6 = peg$otherExpectation("tag value");
  var peg$e7 = peg$classExpectation(['"'], true, false);
  var peg$e8 = peg$otherExpectation("move number");
  var peg$e9 = peg$classExpectation([["0", "9"]], false, false);
  var peg$e10 = peg$literalExpectation(".", false);
  var peg$e11 = peg$classExpectation(["."], false, false);
  var peg$e12 = peg$otherExpectation("standard algebraic notation");
  var peg$e13 = peg$literalExpectation("O-O-O", false);
  var peg$e14 = peg$literalExpectation("O-O", false);
  var peg$e15 = peg$literalExpectation("0-0-0", false);
  var peg$e16 = peg$literalExpectation("0-0", false);
  var peg$e17 = peg$classExpectation([["a", "z"], ["A", "Z"], ["1", "8"], "-", "="], false, false);
  var peg$e18 = peg$classExpectation(["+", "#"], false, false);
  var peg$e19 = peg$otherExpectation("suffix annotation");
  var peg$e20 = peg$classExpectation(["!", "?"], false, false);
  var peg$e21 = peg$otherExpectation("NAG");
  var peg$e22 = peg$literalExpectation("$", false);
  var peg$e23 = peg$otherExpectation("brace comment");
  var peg$e24 = peg$literalExpectation("{", false);
  var peg$e25 = peg$classExpectation(["}"], true, false);
  var peg$e26 = peg$literalExpectation("}", false);
  var peg$e27 = peg$otherExpectation("rest of line comment");
  var peg$e28 = peg$literalExpectation(";", false);
  var peg$e29 = peg$classExpectation(["\r", "\n"], true, false);
  var peg$e30 = peg$otherExpectation("variation");
  var peg$e31 = peg$literalExpectation("(", false);
  var peg$e32 = peg$literalExpectation(")", false);
  var peg$e33 = peg$otherExpectation("game termination marker");
  var peg$e34 = peg$literalExpectation("1-0", false);
  var peg$e35 = peg$literalExpectation("0-1", false);
  var peg$e36 = peg$literalExpectation("1/2-1/2", false);
  var peg$e37 = peg$literalExpectation("*", false);
  var peg$e38 = peg$otherExpectation("whitespace");
  var peg$e39 = peg$classExpectation([" ", "	", "\r", "\n"], false, false);
  var peg$f0 = function(headers, game) {
    return pgn(headers, game);
  };
  var peg$f1 = function(tagPairs) {
    return Object.fromEntries(tagPairs);
  };
  var peg$f2 = function(tagName, tagValue) {
    return [tagName, tagValue];
  };
  var peg$f3 = function(root, marker) {
    return { root, marker };
  };
  var peg$f4 = function(comment, moves) {
    return lineToTree(rootNode(comment), ...moves.flat());
  };
  var peg$f5 = function(san, suffix, nag, comment, variations) {
    return node(san, suffix, nag, comment, variations);
  };
  var peg$f6 = function(nag) {
    return nag;
  };
  var peg$f7 = function(comment) {
    return comment.replace(/[\r\n]+/g, " ");
  };
  var peg$f8 = function(comment) {
    return comment.trim();
  };
  var peg$f9 = function(line) {
    return line;
  };
  var peg$f10 = function(result, comment) {
    return { result, comment };
  };
  var peg$currPos = options.peg$currPos | 0;
  var peg$posDetailsCache = [{ line: 1, column: 1 }];
  var peg$maxFailPos = peg$currPos;
  var peg$maxFailExpected = options.peg$maxFailExpected || [];
  var peg$silentFails = options.peg$silentFails | 0;
  var peg$result;
  if (options.startRule) {
    if (!(options.startRule in peg$startRuleFunctions)) {
      throw new Error(`Can't start parsing from rule "` + options.startRule + '".');
    }
    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
  }
  function peg$literalExpectation(text, ignoreCase) {
    return { type: "literal", text, ignoreCase };
  }
  function peg$classExpectation(parts2, inverted, ignoreCase) {
    return { type: "class", parts: parts2, inverted, ignoreCase };
  }
  function peg$endExpectation() {
    return { type: "end" };
  }
  function peg$otherExpectation(description) {
    return { type: "other", description };
  }
  function peg$computePosDetails(pos) {
    var details = peg$posDetailsCache[pos];
    var p;
    if (details) {
      return details;
    } else {
      if (pos >= peg$posDetailsCache.length) {
        p = peg$posDetailsCache.length - 1;
      } else {
        p = pos;
        while (!peg$posDetailsCache[--p]) {
        }
      }
      details = peg$posDetailsCache[p];
      details = {
        line: details.line,
        column: details.column
      };
      while (p < pos) {
        if (input.charCodeAt(p) === 10) {
          details.line++;
          details.column = 1;
        } else {
          details.column++;
        }
        p++;
      }
      peg$posDetailsCache[pos] = details;
      return details;
    }
  }
  function peg$computeLocation(startPos, endPos, offset) {
    var startPosDetails = peg$computePosDetails(startPos);
    var endPosDetails = peg$computePosDetails(endPos);
    var res = {
      source: peg$source,
      start: {
        offset: startPos,
        line: startPosDetails.line,
        column: startPosDetails.column
      },
      end: {
        offset: endPos,
        line: endPosDetails.line,
        column: endPosDetails.column
      }
    };
    return res;
  }
  function peg$fail(expected) {
    if (peg$currPos < peg$maxFailPos) {
      return;
    }
    if (peg$currPos > peg$maxFailPos) {
      peg$maxFailPos = peg$currPos;
      peg$maxFailExpected = [];
    }
    peg$maxFailExpected.push(expected);
  }
  function peg$buildStructuredError(expected, found, location2) {
    return new peg$SyntaxError(
      peg$SyntaxError.buildMessage(expected, found),
      expected,
      found,
      location2
    );
  }
  function peg$parsepgn() {
    var s0, s1, s2;
    s0 = peg$currPos;
    s1 = peg$parsetagPairSection();
    s2 = peg$parsemoveTextSection();
    s0 = peg$f0(s1, s2);
    return s0;
  }
  function peg$parsetagPairSection() {
    var s0, s1, s2;
    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parsetagPair();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parsetagPair();
    }
    s2 = peg$parse_();
    s0 = peg$f1(s1);
    return s0;
  }
  function peg$parsetagPair() {
    var s0, s2, s4, s6, s7, s8, s10;
    peg$silentFails++;
    s0 = peg$currPos;
    peg$parse_();
    if (input.charCodeAt(peg$currPos) === 91) {
      s2 = peg$c0;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e1);
      }
    }
    if (s2 !== peg$FAILED) {
      peg$parse_();
      s4 = peg$parsetagName();
      if (s4 !== peg$FAILED) {
        peg$parse_();
        if (input.charCodeAt(peg$currPos) === 34) {
          s6 = peg$c1;
          peg$currPos++;
        } else {
          s6 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e2);
          }
        }
        if (s6 !== peg$FAILED) {
          s7 = peg$parsetagValue();
          if (input.charCodeAt(peg$currPos) === 34) {
            s8 = peg$c1;
            peg$currPos++;
          } else {
            s8 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e2);
            }
          }
          if (s8 !== peg$FAILED) {
            peg$parse_();
            if (input.charCodeAt(peg$currPos) === 93) {
              s10 = peg$c2;
              peg$currPos++;
            } else {
              s10 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e3);
              }
            }
            if (s10 !== peg$FAILED) {
              s0 = peg$f2(s4, s7);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      if (peg$silentFails === 0) {
        peg$fail(peg$e0);
      }
    }
    return s0;
  }
  function peg$parsetagName() {
    var s0, s1, s2;
    peg$silentFails++;
    s0 = peg$currPos;
    s1 = [];
    s2 = input.charAt(peg$currPos);
    if (peg$r0.test(s2)) {
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e5);
      }
    }
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = input.charAt(peg$currPos);
        if (peg$r0.test(s2)) {
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e5);
          }
        }
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      s0 = input.substring(s0, peg$currPos);
    } else {
      s0 = s1;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e4);
      }
    }
    return s0;
  }
  function peg$parsetagValue() {
    var s0, s1, s2;
    peg$silentFails++;
    s0 = peg$currPos;
    s1 = [];
    s2 = input.charAt(peg$currPos);
    if (peg$r1.test(s2)) {
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e7);
      }
    }
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = input.charAt(peg$currPos);
      if (peg$r1.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e7);
        }
      }
    }
    s0 = input.substring(s0, peg$currPos);
    peg$silentFails--;
    s1 = peg$FAILED;
    if (peg$silentFails === 0) {
      peg$fail(peg$e6);
    }
    return s0;
  }
  function peg$parsemoveTextSection() {
    var s0, s1, s3;
    s0 = peg$currPos;
    s1 = peg$parseline();
    peg$parse_();
    s3 = peg$parsegameTerminationMarker();
    if (s3 === peg$FAILED) {
      s3 = null;
    }
    peg$parse_();
    s0 = peg$f3(s1, s3);
    return s0;
  }
  function peg$parseline() {
    var s0, s1, s2, s3;
    s0 = peg$currPos;
    s1 = peg$parsecomment();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    s2 = [];
    s3 = peg$parsemove();
    while (s3 !== peg$FAILED) {
      s2.push(s3);
      s3 = peg$parsemove();
    }
    s0 = peg$f4(s1, s2);
    return s0;
  }
  function peg$parsemove() {
    var s0, s4, s5, s6, s7, s8, s9, s10;
    s0 = peg$currPos;
    peg$parse_();
    peg$parsemoveNumber();
    peg$parse_();
    s4 = peg$parsesan();
    if (s4 !== peg$FAILED) {
      s5 = peg$parsesuffixAnnotation();
      if (s5 === peg$FAILED) {
        s5 = null;
      }
      s6 = [];
      s7 = peg$parsenag();
      while (s7 !== peg$FAILED) {
        s6.push(s7);
        s7 = peg$parsenag();
      }
      s7 = peg$parse_();
      s8 = peg$parsecomment();
      if (s8 === peg$FAILED) {
        s8 = null;
      }
      s9 = [];
      s10 = peg$parsevariation();
      while (s10 !== peg$FAILED) {
        s9.push(s10);
        s10 = peg$parsevariation();
      }
      s0 = peg$f5(s4, s5, s6, s8, s9);
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parsemoveNumber() {
    var s0, s1, s2, s3, s4, s5;
    peg$silentFails++;
    s0 = peg$currPos;
    s1 = [];
    s2 = input.charAt(peg$currPos);
    if (peg$r2.test(s2)) {
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e9);
      }
    }
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = input.charAt(peg$currPos);
      if (peg$r2.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e9);
        }
      }
    }
    if (input.charCodeAt(peg$currPos) === 46) {
      s2 = peg$c3;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e10);
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$parse_();
      s4 = [];
      s5 = input.charAt(peg$currPos);
      if (peg$r3.test(s5)) {
        peg$currPos++;
      } else {
        s5 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e11);
        }
      }
      while (s5 !== peg$FAILED) {
        s4.push(s5);
        s5 = input.charAt(peg$currPos);
        if (peg$r3.test(s5)) {
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e11);
          }
        }
      }
      s1 = [s1, s2, s3, s4];
      s0 = s1;
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e8);
      }
    }
    return s0;
  }
  function peg$parsesan() {
    var s0, s1, s2, s3, s4, s5;
    peg$silentFails++;
    s0 = peg$currPos;
    s1 = peg$currPos;
    if (input.substr(peg$currPos, 5) === peg$c4) {
      s2 = peg$c4;
      peg$currPos += 5;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e13);
      }
    }
    if (s2 === peg$FAILED) {
      if (input.substr(peg$currPos, 3) === peg$c5) {
        s2 = peg$c5;
        peg$currPos += 3;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e14);
        }
      }
      if (s2 === peg$FAILED) {
        if (input.substr(peg$currPos, 5) === peg$c6) {
          s2 = peg$c6;
          peg$currPos += 5;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e15);
          }
        }
        if (s2 === peg$FAILED) {
          if (input.substr(peg$currPos, 3) === peg$c7) {
            s2 = peg$c7;
            peg$currPos += 3;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e16);
            }
          }
          if (s2 === peg$FAILED) {
            s2 = peg$currPos;
            s3 = input.charAt(peg$currPos);
            if (peg$r0.test(s3)) {
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e5);
              }
            }
            if (s3 !== peg$FAILED) {
              s4 = [];
              s5 = input.charAt(peg$currPos);
              if (peg$r4.test(s5)) {
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e17);
                }
              }
              if (s5 !== peg$FAILED) {
                while (s5 !== peg$FAILED) {
                  s4.push(s5);
                  s5 = input.charAt(peg$currPos);
                  if (peg$r4.test(s5)) {
                    peg$currPos++;
                  } else {
                    s5 = peg$FAILED;
                    if (peg$silentFails === 0) {
                      peg$fail(peg$e17);
                    }
                  }
                }
              } else {
                s4 = peg$FAILED;
              }
              if (s4 !== peg$FAILED) {
                s3 = [s3, s4];
                s2 = s3;
              } else {
                peg$currPos = s2;
                s2 = peg$FAILED;
              }
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          }
        }
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = input.charAt(peg$currPos);
      if (peg$r5.test(s3)) {
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e18);
        }
      }
      if (s3 === peg$FAILED) {
        s3 = null;
      }
      s2 = [s2, s3];
      s1 = s2;
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      s0 = input.substring(s0, peg$currPos);
    } else {
      s0 = s1;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e12);
      }
    }
    return s0;
  }
  function peg$parsesuffixAnnotation() {
    var s0, s1, s2;
    peg$silentFails++;
    s0 = peg$currPos;
    s1 = [];
    s2 = input.charAt(peg$currPos);
    if (peg$r6.test(s2)) {
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e20);
      }
    }
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      if (s1.length >= 2) {
        s2 = peg$FAILED;
      } else {
        s2 = input.charAt(peg$currPos);
        if (peg$r6.test(s2)) {
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e20);
          }
        }
      }
    }
    if (s1.length < 1) {
      peg$currPos = s0;
      s0 = peg$FAILED;
    } else {
      s0 = s1;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e19);
      }
    }
    return s0;
  }
  function peg$parsenag() {
    var s0, s2, s3, s4, s5;
    peg$silentFails++;
    s0 = peg$currPos;
    peg$parse_();
    if (input.charCodeAt(peg$currPos) === 36) {
      s2 = peg$c8;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e22);
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$currPos;
      s4 = [];
      s5 = input.charAt(peg$currPos);
      if (peg$r2.test(s5)) {
        peg$currPos++;
      } else {
        s5 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e9);
        }
      }
      if (s5 !== peg$FAILED) {
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          s5 = input.charAt(peg$currPos);
          if (peg$r2.test(s5)) {
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e9);
            }
          }
        }
      } else {
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s3 = input.substring(s3, peg$currPos);
      } else {
        s3 = s4;
      }
      if (s3 !== peg$FAILED) {
        s0 = peg$f6(s3);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      if (peg$silentFails === 0) {
        peg$fail(peg$e21);
      }
    }
    return s0;
  }
  function peg$parsecomment() {
    var s0;
    s0 = peg$parsebraceComment();
    if (s0 === peg$FAILED) {
      s0 = peg$parserestOfLineComment();
    }
    return s0;
  }
  function peg$parsebraceComment() {
    var s0, s1, s2, s3, s4;
    peg$silentFails++;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 123) {
      s1 = peg$c9;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e24);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      s3 = [];
      s4 = input.charAt(peg$currPos);
      if (peg$r7.test(s4)) {
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e25);
        }
      }
      while (s4 !== peg$FAILED) {
        s3.push(s4);
        s4 = input.charAt(peg$currPos);
        if (peg$r7.test(s4)) {
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e25);
          }
        }
      }
      s2 = input.substring(s2, peg$currPos);
      if (input.charCodeAt(peg$currPos) === 125) {
        s3 = peg$c10;
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e26);
        }
      }
      if (s3 !== peg$FAILED) {
        s0 = peg$f7(s2);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e23);
      }
    }
    return s0;
  }
  function peg$parserestOfLineComment() {
    var s0, s1, s2, s3, s4;
    peg$silentFails++;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 59) {
      s1 = peg$c11;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e28);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      s3 = [];
      s4 = input.charAt(peg$currPos);
      if (peg$r8.test(s4)) {
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e29);
        }
      }
      while (s4 !== peg$FAILED) {
        s3.push(s4);
        s4 = input.charAt(peg$currPos);
        if (peg$r8.test(s4)) {
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e29);
          }
        }
      }
      s2 = input.substring(s2, peg$currPos);
      s0 = peg$f8(s2);
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e27);
      }
    }
    return s0;
  }
  function peg$parsevariation() {
    var s0, s2, s3, s5;
    peg$silentFails++;
    s0 = peg$currPos;
    peg$parse_();
    if (input.charCodeAt(peg$currPos) === 40) {
      s2 = peg$c12;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e31);
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$parseline();
      if (s3 !== peg$FAILED) {
        peg$parse_();
        if (input.charCodeAt(peg$currPos) === 41) {
          s5 = peg$c13;
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e32);
          }
        }
        if (s5 !== peg$FAILED) {
          s0 = peg$f9(s3);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      if (peg$silentFails === 0) {
        peg$fail(peg$e30);
      }
    }
    return s0;
  }
  function peg$parsegameTerminationMarker() {
    var s0, s1, s3;
    peg$silentFails++;
    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3) === peg$c14) {
      s1 = peg$c14;
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e34);
      }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 3) === peg$c15) {
        s1 = peg$c15;
        peg$currPos += 3;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e35);
        }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 7) === peg$c16) {
          s1 = peg$c16;
          peg$currPos += 7;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e36);
          }
        }
        if (s1 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 42) {
            s1 = peg$c17;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e37);
            }
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$parse_();
      s3 = peg$parsecomment();
      if (s3 === peg$FAILED) {
        s3 = null;
      }
      s0 = peg$f10(s1, s3);
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e33);
      }
    }
    return s0;
  }
  function peg$parse_() {
    var s0, s1;
    peg$silentFails++;
    s0 = [];
    s1 = input.charAt(peg$currPos);
    if (peg$r9.test(s1)) {
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e39);
      }
    }
    while (s1 !== peg$FAILED) {
      s0.push(s1);
      s1 = input.charAt(peg$currPos);
      if (peg$r9.test(s1)) {
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e39);
        }
      }
    }
    peg$silentFails--;
    s1 = peg$FAILED;
    if (peg$silentFails === 0) {
      peg$fail(peg$e38);
    }
    return s0;
  }
  peg$result = peg$startRuleFunction();
  if (options.peg$library) {
    return (
      /** @type {any} */
      {
        peg$result,
        peg$currPos,
        peg$FAILED,
        peg$maxFailExpected,
        peg$maxFailPos
      }
    );
  }
  if (peg$result !== peg$FAILED && peg$currPos === input.length) {
    return peg$result;
  } else {
    if (peg$result !== peg$FAILED && peg$currPos < input.length) {
      peg$fail(peg$endExpectation());
    }
    throw peg$buildStructuredError(
      peg$maxFailExpected,
      peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
      peg$maxFailPos < input.length ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1) : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
    );
  }
}
function rotl(x, k) {
  return (x << k | x >> 64n - k) & 0xffffffffffffffffn;
}
function wrappingMul(x, y) {
  return x * y & MASK64;
}
function xoroshiro128(state) {
  return function() {
    let s0 = BigInt(state & MASK64);
    let s1 = BigInt(state >> 64n & MASK64);
    const result = wrappingMul(rotl(wrappingMul(s0, 5n), 7n), 9n);
    s1 ^= s0;
    s0 = (rotl(s0, 24n) ^ s1 ^ s1 << 16n) & MASK64;
    s1 = rotl(s1, 37n);
    state = s1 << 64n | s0;
    return result;
  };
}
function rank(square) {
  return square >> 4;
}
function file(square) {
  return square & 15;
}
function isDigit(c) {
  return "0123456789".indexOf(c) !== -1;
}
function algebraic(square) {
  const f = file(square);
  const r = rank(square);
  return "abcdefgh".substring(f, f + 1) + "87654321".substring(r, r + 1);
}
function swapColor(color) {
  return color === WHITE ? BLACK : WHITE;
}
function validateFen(fen) {
  const tokens = fen.split(/\s+/);
  if (tokens.length !== 6) {
    return {
      ok: false,
      error: "Invalid FEN: must contain six space-delimited fields"
    };
  }
  const moveNumber = parseInt(tokens[5], 10);
  if (isNaN(moveNumber) || moveNumber <= 0) {
    return {
      ok: false,
      error: "Invalid FEN: move number must be a positive integer"
    };
  }
  const halfMoves = parseInt(tokens[4], 10);
  if (isNaN(halfMoves) || halfMoves < 0) {
    return {
      ok: false,
      error: "Invalid FEN: half move counter number must be a non-negative integer"
    };
  }
  if (!/^(-|[abcdefgh][36])$/.test(tokens[3])) {
    return { ok: false, error: "Invalid FEN: en-passant square is invalid" };
  }
  if (/[^kKqQ-]/.test(tokens[2])) {
    return { ok: false, error: "Invalid FEN: castling availability is invalid" };
  }
  if (!/^(w|b)$/.test(tokens[1])) {
    return { ok: false, error: "Invalid FEN: side-to-move is invalid" };
  }
  const rows = tokens[0].split("/");
  if (rows.length !== 8) {
    return {
      ok: false,
      error: "Invalid FEN: piece data does not contain 8 '/'-delimited rows"
    };
  }
  for (let i = 0; i < rows.length; i++) {
    let sumFields = 0;
    let previousWasNumber = false;
    for (let k = 0; k < rows[i].length; k++) {
      if (isDigit(rows[i][k])) {
        if (previousWasNumber) {
          return {
            ok: false,
            error: "Invalid FEN: piece data is invalid (consecutive number)"
          };
        }
        sumFields += parseInt(rows[i][k], 10);
        previousWasNumber = true;
      } else {
        if (!/^[prnbqkPRNBQK]$/.test(rows[i][k])) {
          return {
            ok: false,
            error: "Invalid FEN: piece data is invalid (invalid piece)"
          };
        }
        sumFields += 1;
        previousWasNumber = false;
      }
    }
    if (sumFields !== 8) {
      return {
        ok: false,
        error: "Invalid FEN: piece data is invalid (too many squares in rank)"
      };
    }
  }
  if (tokens[3][1] == "3" && tokens[1] == "w" || tokens[3][1] == "6" && tokens[1] == "b") {
    return { ok: false, error: "Invalid FEN: illegal en-passant square" };
  }
  const kings = [
    { color: "white", regex: /K/g },
    { color: "black", regex: /k/g }
  ];
  for (const { color, regex } of kings) {
    if (!regex.test(tokens[0])) {
      return { ok: false, error: `Invalid FEN: missing ${color} king` };
    }
    if ((tokens[0].match(regex) || []).length > 1) {
      return { ok: false, error: `Invalid FEN: too many ${color} kings` };
    }
  }
  if (Array.from(rows[0] + rows[7]).some((char) => char.toUpperCase() === "P")) {
    return {
      ok: false,
      error: "Invalid FEN: some pawns are on the edge rows"
    };
  }
  return { ok: true };
}
function getDisambiguator(move, moves) {
  const from = move.from;
  const to = move.to;
  const piece = move.piece;
  let ambiguities = 0;
  let sameRank = 0;
  let sameFile = 0;
  for (let i = 0, len = moves.length; i < len; i++) {
    const ambigFrom = moves[i].from;
    const ambigTo = moves[i].to;
    const ambigPiece = moves[i].piece;
    if (piece === ambigPiece && from !== ambigFrom && to === ambigTo) {
      ambiguities++;
      if (rank(from) === rank(ambigFrom)) {
        sameRank++;
      }
      if (file(from) === file(ambigFrom)) {
        sameFile++;
      }
    }
  }
  if (ambiguities > 0) {
    if (sameRank > 0 && sameFile > 0) {
      return algebraic(from);
    } else if (sameFile > 0) {
      return algebraic(from).charAt(1);
    } else {
      return algebraic(from).charAt(0);
    }
  }
  return "";
}
function addMove(moves, color, from, to, piece, captured = void 0, flags = BITS.NORMAL) {
  const r = rank(to);
  if (piece === PAWN && (r === RANK_1 || r === RANK_8)) {
    for (let i = 0; i < PROMOTIONS.length; i++) {
      const promotion = PROMOTIONS[i];
      moves.push({
        color,
        from,
        to,
        piece,
        captured,
        promotion,
        flags: flags | BITS.PROMOTION
      });
    }
  } else {
    moves.push({
      color,
      from,
      to,
      piece,
      captured,
      flags
    });
  }
}
function inferPieceType(san) {
  let pieceType = san.charAt(0);
  if (pieceType >= "a" && pieceType <= "h") {
    const matches = san.match(/[a-h]\d.*[a-h]\d/);
    if (matches) {
      return void 0;
    }
    return PAWN;
  }
  pieceType = pieceType.toLowerCase();
  if (pieceType === "o") {
    return KING;
  }
  return pieceType;
}
function strippedSan(move) {
  return move.replace(/=/, "").replace(/[+#]?[?!]*$/, "");
}
var MASK64, rand, PIECE_KEYS, EP_KEYS, CASTLING_KEYS, SIDE_KEY, WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, DEFAULT_POSITION, Move, EMPTY, FLAGS, BITS, SEVEN_TAG_ROSTER, SUPLEMENTAL_TAGS, HEADER_TEMPLATE, Ox88, PAWN_OFFSETS, PIECE_OFFSETS, ATTACKS, RAYS, PIECE_MASKS, SYMBOLS, PROMOTIONS, RANK_1, RANK_2, RANK_7, RANK_8, SIDES, ROOKS, SECOND_RANK, SAN_NULLMOVE, Chess;
var init_chess = __esm({
  "node_modules/chess.js/dist/esm/chess.js"() {
    peg$subclass(peg$SyntaxError, Error);
    peg$SyntaxError.prototype.format = function(sources) {
      var str = "Error: " + this.message;
      if (this.location) {
        var src = null;
        var k;
        for (k = 0; k < sources.length; k++) {
          if (sources[k].source === this.location.source) {
            src = sources[k].text.split(/\r\n|\n|\r/g);
            break;
          }
        }
        var s = this.location.start;
        var offset_s = this.location.source && typeof this.location.source.offset === "function" ? this.location.source.offset(s) : s;
        var loc = this.location.source + ":" + offset_s.line + ":" + offset_s.column;
        if (src) {
          var e = this.location.end;
          var filler = peg$padEnd("", offset_s.line.toString().length, " ");
          var line = src[s.line - 1];
          var last = s.line === e.line ? e.column : line.length + 1;
          var hatLen = last - s.column || 1;
          str += "\n --> " + loc + "\n" + filler + " |\n" + offset_s.line + " | " + line + "\n" + filler + " | " + peg$padEnd("", s.column - 1, " ") + peg$padEnd("", hatLen, "^");
        } else {
          str += "\n at " + loc;
        }
      }
      return str;
    };
    peg$SyntaxError.buildMessage = function(expected, found) {
      var DESCRIBE_EXPECTATION_FNS = {
        literal: function(expectation) {
          return '"' + literalEscape(expectation.text) + '"';
        },
        class: function(expectation) {
          var escapedParts = expectation.parts.map(function(part) {
            return Array.isArray(part) ? classEscape(part[0]) + "-" + classEscape(part[1]) : classEscape(part);
          });
          return "[" + (expectation.inverted ? "^" : "") + escapedParts.join("") + "]";
        },
        any: function() {
          return "any character";
        },
        end: function() {
          return "end of input";
        },
        other: function(expectation) {
          return expectation.description;
        }
      };
      function hex(ch) {
        return ch.charCodeAt(0).toString(16).toUpperCase();
      }
      function literalEscape(s) {
        return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(ch) {
          return "\\x0" + hex(ch);
        }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) {
          return "\\x" + hex(ch);
        });
      }
      function classEscape(s) {
        return s.replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\^/g, "\\^").replace(/-/g, "\\-").replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(ch) {
          return "\\x0" + hex(ch);
        }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) {
          return "\\x" + hex(ch);
        });
      }
      function describeExpectation(expectation) {
        return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
      }
      function describeExpected(expected2) {
        var descriptions = expected2.map(describeExpectation);
        var i, j;
        descriptions.sort();
        if (descriptions.length > 0) {
          for (i = 1, j = 1; i < descriptions.length; i++) {
            if (descriptions[i - 1] !== descriptions[i]) {
              descriptions[j] = descriptions[i];
              j++;
            }
          }
          descriptions.length = j;
        }
        switch (descriptions.length) {
          case 1:
            return descriptions[0];
          case 2:
            return descriptions[0] + " or " + descriptions[1];
          default:
            return descriptions.slice(0, -1).join(", ") + ", or " + descriptions[descriptions.length - 1];
        }
      }
      function describeFound(found2) {
        return found2 ? '"' + literalEscape(found2) + '"' : "end of input";
      }
      return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
    };
    MASK64 = 0xffffffffffffffffn;
    rand = xoroshiro128(0xa187eb39cdcaed8f31c4b365b102e01en);
    PIECE_KEYS = Array.from({ length: 2 }, () => Array.from({ length: 6 }, () => Array.from({ length: 128 }, () => rand())));
    EP_KEYS = Array.from({ length: 8 }, () => rand());
    CASTLING_KEYS = Array.from({ length: 16 }, () => rand());
    SIDE_KEY = rand();
    WHITE = "w";
    BLACK = "b";
    PAWN = "p";
    KNIGHT = "n";
    BISHOP = "b";
    ROOK = "r";
    QUEEN = "q";
    KING = "k";
    DEFAULT_POSITION = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    Move = class {
      color;
      from;
      to;
      piece;
      captured;
      promotion;
      /**
       * @deprecated This field is deprecated and will be removed in version 2.0.0.
       * Please use move descriptor functions instead: `isCapture`, `isPromotion`,
       * `isEnPassant`, `isKingsideCastle`, `isQueensideCastle`, `isCastle`, and
       * `isBigPawn`
       */
      flags;
      san;
      lan;
      before;
      after;
      constructor(chess, internal) {
        const { color, piece, from, to, flags, captured, promotion } = internal;
        const fromAlgebraic = algebraic(from);
        const toAlgebraic = algebraic(to);
        this.color = color;
        this.piece = piece;
        this.from = fromAlgebraic;
        this.to = toAlgebraic;
        this.san = chess["_moveToSan"](internal, chess["_moves"]({ legal: true }));
        this.lan = fromAlgebraic + toAlgebraic;
        this.before = chess.fen();
        chess["_makeMove"](internal);
        this.after = chess.fen();
        chess["_undoMove"]();
        this.flags = "";
        for (const flag in BITS) {
          if (BITS[flag] & flags) {
            this.flags += FLAGS[flag];
          }
        }
        if (captured) {
          this.captured = captured;
        }
        if (promotion) {
          this.promotion = promotion;
          this.lan += promotion;
        }
      }
      isCapture() {
        return this.flags.indexOf(FLAGS["CAPTURE"]) > -1;
      }
      isPromotion() {
        return this.flags.indexOf(FLAGS["PROMOTION"]) > -1;
      }
      isEnPassant() {
        return this.flags.indexOf(FLAGS["EP_CAPTURE"]) > -1;
      }
      isKingsideCastle() {
        return this.flags.indexOf(FLAGS["KSIDE_CASTLE"]) > -1;
      }
      isQueensideCastle() {
        return this.flags.indexOf(FLAGS["QSIDE_CASTLE"]) > -1;
      }
      isBigPawn() {
        return this.flags.indexOf(FLAGS["BIG_PAWN"]) > -1;
      }
    };
    EMPTY = -1;
    FLAGS = {
      NORMAL: "n",
      CAPTURE: "c",
      BIG_PAWN: "b",
      EP_CAPTURE: "e",
      PROMOTION: "p",
      KSIDE_CASTLE: "k",
      QSIDE_CASTLE: "q",
      NULL_MOVE: "-"
    };
    BITS = {
      NORMAL: 1,
      CAPTURE: 2,
      BIG_PAWN: 4,
      EP_CAPTURE: 8,
      PROMOTION: 16,
      KSIDE_CASTLE: 32,
      QSIDE_CASTLE: 64,
      NULL_MOVE: 128
    };
    SEVEN_TAG_ROSTER = {
      Event: "?",
      Site: "?",
      Date: "????.??.??",
      Round: "?",
      White: "?",
      Black: "?",
      Result: "*"
    };
    SUPLEMENTAL_TAGS = {
      WhiteTitle: null,
      BlackTitle: null,
      WhiteElo: null,
      BlackElo: null,
      WhiteUSCF: null,
      BlackUSCF: null,
      WhiteNA: null,
      BlackNA: null,
      WhiteType: null,
      BlackType: null,
      EventDate: null,
      EventSponsor: null,
      Section: null,
      Stage: null,
      Board: null,
      Opening: null,
      Variation: null,
      SubVariation: null,
      ECO: null,
      NIC: null,
      Time: null,
      UTCTime: null,
      UTCDate: null,
      TimeControl: null,
      SetUp: null,
      FEN: null,
      Termination: null,
      Annotator: null,
      Mode: null,
      PlyCount: null
    };
    HEADER_TEMPLATE = {
      ...SEVEN_TAG_ROSTER,
      ...SUPLEMENTAL_TAGS
    };
    Ox88 = {
      a8: 0,
      b8: 1,
      c8: 2,
      d8: 3,
      e8: 4,
      f8: 5,
      g8: 6,
      h8: 7,
      a7: 16,
      b7: 17,
      c7: 18,
      d7: 19,
      e7: 20,
      f7: 21,
      g7: 22,
      h7: 23,
      a6: 32,
      b6: 33,
      c6: 34,
      d6: 35,
      e6: 36,
      f6: 37,
      g6: 38,
      h6: 39,
      a5: 48,
      b5: 49,
      c5: 50,
      d5: 51,
      e5: 52,
      f5: 53,
      g5: 54,
      h5: 55,
      a4: 64,
      b4: 65,
      c4: 66,
      d4: 67,
      e4: 68,
      f4: 69,
      g4: 70,
      h4: 71,
      a3: 80,
      b3: 81,
      c3: 82,
      d3: 83,
      e3: 84,
      f3: 85,
      g3: 86,
      h3: 87,
      a2: 96,
      b2: 97,
      c2: 98,
      d2: 99,
      e2: 100,
      f2: 101,
      g2: 102,
      h2: 103,
      a1: 112,
      b1: 113,
      c1: 114,
      d1: 115,
      e1: 116,
      f1: 117,
      g1: 118,
      h1: 119
    };
    PAWN_OFFSETS = {
      b: [16, 32, 17, 15],
      w: [-16, -32, -17, -15]
    };
    PIECE_OFFSETS = {
      n: [-18, -33, -31, -14, 18, 33, 31, 14],
      b: [-17, -15, 17, 15],
      r: [-16, 1, 16, -1],
      q: [-17, -16, -15, 1, 17, 16, 15, -1],
      k: [-17, -16, -15, 1, 17, 16, 15, -1]
    };
    ATTACKS = [
      20,
      0,
      0,
      0,
      0,
      0,
      0,
      24,
      0,
      0,
      0,
      0,
      0,
      0,
      20,
      0,
      0,
      20,
      0,
      0,
      0,
      0,
      0,
      24,
      0,
      0,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      0,
      24,
      0,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      24,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      20,
      0,
      0,
      24,
      0,
      0,
      20,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      20,
      2,
      24,
      2,
      20,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      2,
      53,
      56,
      53,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      24,
      24,
      24,
      24,
      24,
      24,
      56,
      0,
      56,
      24,
      24,
      24,
      24,
      24,
      24,
      0,
      0,
      0,
      0,
      0,
      0,
      2,
      53,
      56,
      53,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      20,
      2,
      24,
      2,
      20,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      20,
      0,
      0,
      24,
      0,
      0,
      20,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      24,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      0,
      24,
      0,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      0,
      0,
      24,
      0,
      0,
      0,
      0,
      0,
      20,
      0,
      0,
      20,
      0,
      0,
      0,
      0,
      0,
      0,
      24,
      0,
      0,
      0,
      0,
      0,
      0,
      20
    ];
    RAYS = [
      17,
      0,
      0,
      0,
      0,
      0,
      0,
      16,
      0,
      0,
      0,
      0,
      0,
      0,
      15,
      0,
      0,
      17,
      0,
      0,
      0,
      0,
      0,
      16,
      0,
      0,
      0,
      0,
      0,
      15,
      0,
      0,
      0,
      0,
      17,
      0,
      0,
      0,
      0,
      16,
      0,
      0,
      0,
      0,
      15,
      0,
      0,
      0,
      0,
      0,
      0,
      17,
      0,
      0,
      0,
      16,
      0,
      0,
      0,
      15,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      17,
      0,
      0,
      16,
      0,
      0,
      15,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      17,
      0,
      16,
      0,
      15,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      17,
      16,
      15,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      -15,
      -16,
      -17,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      -15,
      0,
      -16,
      0,
      -17,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      -15,
      0,
      0,
      -16,
      0,
      0,
      -17,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      -15,
      0,
      0,
      0,
      -16,
      0,
      0,
      0,
      -17,
      0,
      0,
      0,
      0,
      0,
      0,
      -15,
      0,
      0,
      0,
      0,
      -16,
      0,
      0,
      0,
      0,
      -17,
      0,
      0,
      0,
      0,
      -15,
      0,
      0,
      0,
      0,
      0,
      -16,
      0,
      0,
      0,
      0,
      0,
      -17,
      0,
      0,
      -15,
      0,
      0,
      0,
      0,
      0,
      0,
      -16,
      0,
      0,
      0,
      0,
      0,
      0,
      -17
    ];
    PIECE_MASKS = { p: 1, n: 2, b: 4, r: 8, q: 16, k: 32 };
    SYMBOLS = "pnbrqkPNBRQK";
    PROMOTIONS = [KNIGHT, BISHOP, ROOK, QUEEN];
    RANK_1 = 7;
    RANK_2 = 6;
    RANK_7 = 1;
    RANK_8 = 0;
    SIDES = {
      [KING]: BITS.KSIDE_CASTLE,
      [QUEEN]: BITS.QSIDE_CASTLE
    };
    ROOKS = {
      w: [
        { square: Ox88.a1, flag: BITS.QSIDE_CASTLE },
        { square: Ox88.h1, flag: BITS.KSIDE_CASTLE }
      ],
      b: [
        { square: Ox88.a8, flag: BITS.QSIDE_CASTLE },
        { square: Ox88.h8, flag: BITS.KSIDE_CASTLE }
      ]
    };
    SECOND_RANK = { b: RANK_7, w: RANK_2 };
    SAN_NULLMOVE = "--";
    Chess = class {
      _board = new Array(128);
      _turn = WHITE;
      _header = {};
      _kings = { w: EMPTY, b: EMPTY };
      _epSquare = -1;
      _halfMoves = 0;
      _moveNumber = 0;
      _history = [];
      _comments = {};
      _castling = { w: 0, b: 0 };
      _hash = 0n;
      // tracks number of times a position has been seen for repetition checking
      _positionCount = /* @__PURE__ */ new Map();
      constructor(fen = DEFAULT_POSITION, { skipValidation = false } = {}) {
        this.load(fen, { skipValidation });
      }
      clear({ preserveHeaders = false } = {}) {
        this._board = new Array(128);
        this._kings = { w: EMPTY, b: EMPTY };
        this._turn = WHITE;
        this._castling = { w: 0, b: 0 };
        this._epSquare = EMPTY;
        this._halfMoves = 0;
        this._moveNumber = 1;
        this._history = [];
        this._comments = {};
        this._header = preserveHeaders ? this._header : { ...HEADER_TEMPLATE };
        this._hash = this._computeHash();
        this._positionCount = /* @__PURE__ */ new Map();
        this._header["SetUp"] = null;
        this._header["FEN"] = null;
      }
      load(fen, { skipValidation = false, preserveHeaders = false } = {}) {
        let tokens = fen.split(/\s+/);
        if (tokens.length >= 2 && tokens.length < 6) {
          const adjustments = ["-", "-", "0", "1"];
          fen = tokens.concat(adjustments.slice(-(6 - tokens.length))).join(" ");
        }
        tokens = fen.split(/\s+/);
        if (!skipValidation) {
          const { ok, error } = validateFen(fen);
          if (!ok) {
            throw new Error(error);
          }
        }
        const position = tokens[0];
        let square = 0;
        this.clear({ preserveHeaders });
        for (let i = 0; i < position.length; i++) {
          const piece = position.charAt(i);
          if (piece === "/") {
            square += 8;
          } else if (isDigit(piece)) {
            square += parseInt(piece, 10);
          } else {
            const color = piece < "a" ? WHITE : BLACK;
            this._put({ type: piece.toLowerCase(), color }, algebraic(square));
            square++;
          }
        }
        this._turn = tokens[1];
        if (tokens[2].indexOf("K") > -1) {
          this._castling.w |= BITS.KSIDE_CASTLE;
        }
        if (tokens[2].indexOf("Q") > -1) {
          this._castling.w |= BITS.QSIDE_CASTLE;
        }
        if (tokens[2].indexOf("k") > -1) {
          this._castling.b |= BITS.KSIDE_CASTLE;
        }
        if (tokens[2].indexOf("q") > -1) {
          this._castling.b |= BITS.QSIDE_CASTLE;
        }
        this._epSquare = tokens[3] === "-" ? EMPTY : Ox88[tokens[3]];
        this._halfMoves = parseInt(tokens[4], 10);
        this._moveNumber = parseInt(tokens[5], 10);
        this._hash = this._computeHash();
        this._updateSetup(fen);
        this._incPositionCount();
      }
      fen({ forceEnpassantSquare = false } = {}) {
        let empty2 = 0;
        let fen = "";
        for (let i = Ox88.a8; i <= Ox88.h1; i++) {
          if (this._board[i]) {
            if (empty2 > 0) {
              fen += empty2;
              empty2 = 0;
            }
            const { color, type: piece } = this._board[i];
            fen += color === WHITE ? piece.toUpperCase() : piece.toLowerCase();
          } else {
            empty2++;
          }
          if (i + 1 & 136) {
            if (empty2 > 0) {
              fen += empty2;
            }
            if (i !== Ox88.h1) {
              fen += "/";
            }
            empty2 = 0;
            i += 8;
          }
        }
        let castling = "";
        if (this._castling[WHITE] & BITS.KSIDE_CASTLE) {
          castling += "K";
        }
        if (this._castling[WHITE] & BITS.QSIDE_CASTLE) {
          castling += "Q";
        }
        if (this._castling[BLACK] & BITS.KSIDE_CASTLE) {
          castling += "k";
        }
        if (this._castling[BLACK] & BITS.QSIDE_CASTLE) {
          castling += "q";
        }
        castling = castling || "-";
        let epSquare = "-";
        if (this._epSquare !== EMPTY) {
          if (forceEnpassantSquare) {
            epSquare = algebraic(this._epSquare);
          } else {
            const bigPawnSquare = this._epSquare + (this._turn === WHITE ? 16 : -16);
            const squares = [bigPawnSquare + 1, bigPawnSquare - 1];
            for (const square of squares) {
              if (square & 136) {
                continue;
              }
              const color = this._turn;
              if (this._board[square]?.color === color && this._board[square]?.type === PAWN) {
                this._makeMove({
                  color,
                  from: square,
                  to: this._epSquare,
                  piece: PAWN,
                  captured: PAWN,
                  flags: BITS.EP_CAPTURE
                });
                const isLegal = !this._isKingAttacked(color);
                this._undoMove();
                if (isLegal) {
                  epSquare = algebraic(this._epSquare);
                  break;
                }
              }
            }
          }
        }
        return [
          fen,
          this._turn,
          castling,
          epSquare,
          this._halfMoves,
          this._moveNumber
        ].join(" ");
      }
      _pieceKey(i) {
        if (!this._board[i]) {
          return 0n;
        }
        const { color, type } = this._board[i];
        const colorIndex = {
          w: 0,
          b: 1
        }[color];
        const typeIndex = {
          p: 0,
          n: 1,
          b: 2,
          r: 3,
          q: 4,
          k: 5
        }[type];
        return PIECE_KEYS[colorIndex][typeIndex][i];
      }
      _epKey() {
        return this._epSquare === EMPTY ? 0n : EP_KEYS[this._epSquare & 7];
      }
      _castlingKey() {
        const index = this._castling.w >> 5 | this._castling.b >> 3;
        return CASTLING_KEYS[index];
      }
      _computeHash() {
        let hash = 0n;
        for (let i = Ox88.a8; i <= Ox88.h1; i++) {
          if (i & 136) {
            i += 7;
            continue;
          }
          if (this._board[i]) {
            hash ^= this._pieceKey(i);
          }
        }
        hash ^= this._epKey();
        hash ^= this._castlingKey();
        if (this._turn === "b") {
          hash ^= SIDE_KEY;
        }
        return hash;
      }
      /*
       * Called when the initial board setup is changed with put() or remove().
       * modifies the SetUp and FEN properties of the header object. If the FEN
       * is equal to the default position, the SetUp and FEN are deleted the setup
       * is only updated if history.length is zero, ie moves haven't been made.
       */
      _updateSetup(fen) {
        if (this._history.length > 0)
          return;
        if (fen !== DEFAULT_POSITION) {
          this._header["SetUp"] = "1";
          this._header["FEN"] = fen;
        } else {
          this._header["SetUp"] = null;
          this._header["FEN"] = null;
        }
      }
      reset() {
        this.load(DEFAULT_POSITION);
      }
      get(square) {
        return this._board[Ox88[square]];
      }
      findPiece(piece) {
        const squares = [];
        for (let i = Ox88.a8; i <= Ox88.h1; i++) {
          if (i & 136) {
            i += 7;
            continue;
          }
          if (!this._board[i] || this._board[i]?.color !== piece.color) {
            continue;
          }
          if (this._board[i].color === piece.color && this._board[i].type === piece.type) {
            squares.push(algebraic(i));
          }
        }
        return squares;
      }
      put({ type, color }, square) {
        if (this._put({ type, color }, square)) {
          this._updateCastlingRights();
          this._updateEnPassantSquare();
          this._updateSetup(this.fen());
          return true;
        }
        return false;
      }
      _set(sq, piece) {
        this._hash ^= this._pieceKey(sq);
        this._board[sq] = piece;
        this._hash ^= this._pieceKey(sq);
      }
      _put({ type, color }, square) {
        if (SYMBOLS.indexOf(type.toLowerCase()) === -1) {
          return false;
        }
        if (!(square in Ox88)) {
          return false;
        }
        const sq = Ox88[square];
        if (type == KING && !(this._kings[color] == EMPTY || this._kings[color] == sq)) {
          return false;
        }
        const currentPieceOnSquare = this._board[sq];
        if (currentPieceOnSquare && currentPieceOnSquare.type === KING) {
          this._kings[currentPieceOnSquare.color] = EMPTY;
        }
        this._set(sq, { type, color });
        if (type === KING) {
          this._kings[color] = sq;
        }
        return true;
      }
      _clear(sq) {
        this._hash ^= this._pieceKey(sq);
        delete this._board[sq];
      }
      remove(square) {
        const piece = this.get(square);
        this._clear(Ox88[square]);
        if (piece && piece.type === KING) {
          this._kings[piece.color] = EMPTY;
        }
        this._updateCastlingRights();
        this._updateEnPassantSquare();
        this._updateSetup(this.fen());
        return piece;
      }
      _updateCastlingRights() {
        this._hash ^= this._castlingKey();
        const whiteKingInPlace = this._board[Ox88.e1]?.type === KING && this._board[Ox88.e1]?.color === WHITE;
        const blackKingInPlace = this._board[Ox88.e8]?.type === KING && this._board[Ox88.e8]?.color === BLACK;
        if (!whiteKingInPlace || this._board[Ox88.a1]?.type !== ROOK || this._board[Ox88.a1]?.color !== WHITE) {
          this._castling.w &= -65;
        }
        if (!whiteKingInPlace || this._board[Ox88.h1]?.type !== ROOK || this._board[Ox88.h1]?.color !== WHITE) {
          this._castling.w &= -33;
        }
        if (!blackKingInPlace || this._board[Ox88.a8]?.type !== ROOK || this._board[Ox88.a8]?.color !== BLACK) {
          this._castling.b &= -65;
        }
        if (!blackKingInPlace || this._board[Ox88.h8]?.type !== ROOK || this._board[Ox88.h8]?.color !== BLACK) {
          this._castling.b &= -33;
        }
        this._hash ^= this._castlingKey();
      }
      _updateEnPassantSquare() {
        if (this._epSquare === EMPTY) {
          return;
        }
        const startSquare = this._epSquare + (this._turn === WHITE ? -16 : 16);
        const currentSquare = this._epSquare + (this._turn === WHITE ? 16 : -16);
        const attackers = [currentSquare + 1, currentSquare - 1];
        if (this._board[startSquare] !== null || this._board[this._epSquare] !== null || this._board[currentSquare]?.color !== swapColor(this._turn) || this._board[currentSquare]?.type !== PAWN) {
          this._hash ^= this._epKey();
          this._epSquare = EMPTY;
          return;
        }
        const canCapture = (square) => !(square & 136) && this._board[square]?.color === this._turn && this._board[square]?.type === PAWN;
        if (!attackers.some(canCapture)) {
          this._hash ^= this._epKey();
          this._epSquare = EMPTY;
        }
      }
      _attacked(color, square, verbose) {
        const attackers = [];
        for (let i = Ox88.a8; i <= Ox88.h1; i++) {
          if (i & 136) {
            i += 7;
            continue;
          }
          if (this._board[i] === void 0 || this._board[i].color !== color) {
            continue;
          }
          const piece = this._board[i];
          const difference = i - square;
          if (difference === 0) {
            continue;
          }
          const index = difference + 119;
          if (ATTACKS[index] & PIECE_MASKS[piece.type]) {
            if (piece.type === PAWN) {
              if (difference > 0 && piece.color === WHITE || difference <= 0 && piece.color === BLACK) {
                if (!verbose) {
                  return true;
                } else {
                  attackers.push(algebraic(i));
                }
              }
              continue;
            }
            if (piece.type === "n" || piece.type === "k") {
              if (!verbose) {
                return true;
              } else {
                attackers.push(algebraic(i));
                continue;
              }
            }
            const offset = RAYS[index];
            let j = i + offset;
            let blocked = false;
            while (j !== square) {
              if (this._board[j] != null) {
                blocked = true;
                break;
              }
              j += offset;
            }
            if (!blocked) {
              if (!verbose) {
                return true;
              } else {
                attackers.push(algebraic(i));
                continue;
              }
            }
          }
        }
        if (verbose) {
          return attackers;
        } else {
          return false;
        }
      }
      attackers(square, attackedBy) {
        if (!attackedBy) {
          return this._attacked(this._turn, Ox88[square], true);
        } else {
          return this._attacked(attackedBy, Ox88[square], true);
        }
      }
      _isKingAttacked(color) {
        const square = this._kings[color];
        return square === -1 ? false : this._attacked(swapColor(color), square);
      }
      hash() {
        return this._hash.toString(16);
      }
      isAttacked(square, attackedBy) {
        return this._attacked(attackedBy, Ox88[square]);
      }
      isCheck() {
        return this._isKingAttacked(this._turn);
      }
      inCheck() {
        return this.isCheck();
      }
      isCheckmate() {
        return this.isCheck() && this._moves().length === 0;
      }
      isStalemate() {
        return !this.isCheck() && this._moves().length === 0;
      }
      isInsufficientMaterial() {
        const pieces = {
          b: 0,
          n: 0,
          r: 0,
          q: 0,
          k: 0,
          p: 0
        };
        const bishops = [];
        let numPieces = 0;
        let squareColor = 0;
        for (let i = Ox88.a8; i <= Ox88.h1; i++) {
          squareColor = (squareColor + 1) % 2;
          if (i & 136) {
            i += 7;
            continue;
          }
          const piece = this._board[i];
          if (piece) {
            pieces[piece.type] = piece.type in pieces ? pieces[piece.type] + 1 : 1;
            if (piece.type === BISHOP) {
              bishops.push(squareColor);
            }
            numPieces++;
          }
        }
        if (numPieces === 2) {
          return true;
        } else if (
          // k vs. kn .... or .... k vs. kb
          numPieces === 3 && (pieces[BISHOP] === 1 || pieces[KNIGHT] === 1)
        ) {
          return true;
        } else if (numPieces === pieces[BISHOP] + 2) {
          let sum = 0;
          const len = bishops.length;
          for (let i = 0; i < len; i++) {
            sum += bishops[i];
          }
          if (sum === 0 || sum === len) {
            return true;
          }
        }
        return false;
      }
      isThreefoldRepetition() {
        return this._getPositionCount(this._hash) >= 3;
      }
      isDrawByFiftyMoves() {
        return this._halfMoves >= 100;
      }
      isDraw() {
        return this.isDrawByFiftyMoves() || this.isStalemate() || this.isInsufficientMaterial() || this.isThreefoldRepetition();
      }
      isGameOver() {
        return this.isCheckmate() || this.isDraw();
      }
      moves({ verbose = false, square = void 0, piece = void 0 } = {}) {
        const moves = this._moves({ square, piece });
        if (verbose) {
          return moves.map((move) => new Move(this, move));
        } else {
          return moves.map((move) => this._moveToSan(move, moves));
        }
      }
      _moves({ legal = true, piece = void 0, square = void 0 } = {}) {
        const forSquare = square ? square.toLowerCase() : void 0;
        const forPiece = piece?.toLowerCase();
        const moves = [];
        const us = this._turn;
        const them = swapColor(us);
        let firstSquare = Ox88.a8;
        let lastSquare = Ox88.h1;
        let singleSquare = false;
        if (forSquare) {
          if (!(forSquare in Ox88)) {
            return [];
          } else {
            firstSquare = lastSquare = Ox88[forSquare];
            singleSquare = true;
          }
        }
        for (let from = firstSquare; from <= lastSquare; from++) {
          if (from & 136) {
            from += 7;
            continue;
          }
          if (!this._board[from] || this._board[from].color === them) {
            continue;
          }
          const { type } = this._board[from];
          let to;
          if (type === PAWN) {
            if (forPiece && forPiece !== type)
              continue;
            to = from + PAWN_OFFSETS[us][0];
            if (!this._board[to]) {
              addMove(moves, us, from, to, PAWN);
              to = from + PAWN_OFFSETS[us][1];
              if (SECOND_RANK[us] === rank(from) && !this._board[to]) {
                addMove(moves, us, from, to, PAWN, void 0, BITS.BIG_PAWN);
              }
            }
            for (let j = 2; j < 4; j++) {
              to = from + PAWN_OFFSETS[us][j];
              if (to & 136)
                continue;
              if (this._board[to]?.color === them) {
                addMove(moves, us, from, to, PAWN, this._board[to].type, BITS.CAPTURE);
              } else if (to === this._epSquare) {
                addMove(moves, us, from, to, PAWN, PAWN, BITS.EP_CAPTURE);
              }
            }
          } else {
            if (forPiece && forPiece !== type)
              continue;
            for (let j = 0, len = PIECE_OFFSETS[type].length; j < len; j++) {
              const offset = PIECE_OFFSETS[type][j];
              to = from;
              while (true) {
                to += offset;
                if (to & 136)
                  break;
                if (!this._board[to]) {
                  addMove(moves, us, from, to, type);
                } else {
                  if (this._board[to].color === us)
                    break;
                  addMove(moves, us, from, to, type, this._board[to].type, BITS.CAPTURE);
                  break;
                }
                if (type === KNIGHT || type === KING)
                  break;
              }
            }
          }
        }
        if (forPiece === void 0 || forPiece === KING) {
          if (!singleSquare || lastSquare === this._kings[us]) {
            if (this._castling[us] & BITS.KSIDE_CASTLE) {
              const castlingFrom = this._kings[us];
              const castlingTo = castlingFrom + 2;
              if (!this._board[castlingFrom + 1] && !this._board[castlingTo] && !this._attacked(them, this._kings[us]) && !this._attacked(them, castlingFrom + 1) && !this._attacked(them, castlingTo)) {
                addMove(moves, us, this._kings[us], castlingTo, KING, void 0, BITS.KSIDE_CASTLE);
              }
            }
            if (this._castling[us] & BITS.QSIDE_CASTLE) {
              const castlingFrom = this._kings[us];
              const castlingTo = castlingFrom - 2;
              if (!this._board[castlingFrom - 1] && !this._board[castlingFrom - 2] && !this._board[castlingFrom - 3] && !this._attacked(them, this._kings[us]) && !this._attacked(them, castlingFrom - 1) && !this._attacked(them, castlingTo)) {
                addMove(moves, us, this._kings[us], castlingTo, KING, void 0, BITS.QSIDE_CASTLE);
              }
            }
          }
        }
        if (!legal || this._kings[us] === -1) {
          return moves;
        }
        const legalMoves = [];
        for (let i = 0, len = moves.length; i < len; i++) {
          this._makeMove(moves[i]);
          if (!this._isKingAttacked(us)) {
            legalMoves.push(moves[i]);
          }
          this._undoMove();
        }
        return legalMoves;
      }
      move(move, { strict = false } = {}) {
        let moveObj = null;
        if (typeof move === "string") {
          moveObj = this._moveFromSan(move, strict);
        } else if (move === null) {
          moveObj = this._moveFromSan(SAN_NULLMOVE, strict);
        } else if (typeof move === "object") {
          const moves = this._moves();
          for (let i = 0, len = moves.length; i < len; i++) {
            if (move.from === algebraic(moves[i].from) && move.to === algebraic(moves[i].to) && (!("promotion" in moves[i]) || move.promotion === moves[i].promotion)) {
              moveObj = moves[i];
              break;
            }
          }
        }
        if (!moveObj) {
          if (typeof move === "string") {
            throw new Error(`Invalid move: ${move}`);
          } else {
            throw new Error(`Invalid move: ${JSON.stringify(move)}`);
          }
        }
        if (this.isCheck() && moveObj.flags & BITS.NULL_MOVE) {
          throw new Error("Null move not allowed when in check");
        }
        const prettyMove = new Move(this, moveObj);
        this._makeMove(moveObj);
        this._incPositionCount();
        return prettyMove;
      }
      _push(move) {
        this._history.push({
          move,
          kings: { b: this._kings.b, w: this._kings.w },
          turn: this._turn,
          castling: { b: this._castling.b, w: this._castling.w },
          epSquare: this._epSquare,
          halfMoves: this._halfMoves,
          moveNumber: this._moveNumber
        });
      }
      _movePiece(from, to) {
        this._hash ^= this._pieceKey(from);
        this._board[to] = this._board[from];
        delete this._board[from];
        this._hash ^= this._pieceKey(to);
      }
      _makeMove(move) {
        const us = this._turn;
        const them = swapColor(us);
        this._push(move);
        if (move.flags & BITS.NULL_MOVE) {
          if (us === BLACK) {
            this._moveNumber++;
          }
          this._halfMoves++;
          this._turn = them;
          this._epSquare = EMPTY;
          return;
        }
        this._hash ^= this._epKey();
        this._hash ^= this._castlingKey();
        if (move.captured) {
          this._hash ^= this._pieceKey(move.to);
        }
        this._movePiece(move.from, move.to);
        if (move.flags & BITS.EP_CAPTURE) {
          if (this._turn === BLACK) {
            this._clear(move.to - 16);
          } else {
            this._clear(move.to + 16);
          }
        }
        if (move.promotion) {
          this._clear(move.to);
          this._set(move.to, { type: move.promotion, color: us });
        }
        if (this._board[move.to].type === KING) {
          this._kings[us] = move.to;
          if (move.flags & BITS.KSIDE_CASTLE) {
            const castlingTo = move.to - 1;
            const castlingFrom = move.to + 1;
            this._movePiece(castlingFrom, castlingTo);
          } else if (move.flags & BITS.QSIDE_CASTLE) {
            const castlingTo = move.to + 1;
            const castlingFrom = move.to - 2;
            this._movePiece(castlingFrom, castlingTo);
          }
          this._castling[us] = 0;
        }
        if (this._castling[us]) {
          for (let i = 0, len = ROOKS[us].length; i < len; i++) {
            if (move.from === ROOKS[us][i].square && this._castling[us] & ROOKS[us][i].flag) {
              this._castling[us] ^= ROOKS[us][i].flag;
              break;
            }
          }
        }
        if (this._castling[them]) {
          for (let i = 0, len = ROOKS[them].length; i < len; i++) {
            if (move.to === ROOKS[them][i].square && this._castling[them] & ROOKS[them][i].flag) {
              this._castling[them] ^= ROOKS[them][i].flag;
              break;
            }
          }
        }
        this._hash ^= this._castlingKey();
        if (move.flags & BITS.BIG_PAWN) {
          let epSquare;
          if (us === BLACK) {
            epSquare = move.to - 16;
          } else {
            epSquare = move.to + 16;
          }
          if (!(move.to - 1 & 136) && this._board[move.to - 1]?.type === PAWN && this._board[move.to - 1]?.color === them || !(move.to + 1 & 136) && this._board[move.to + 1]?.type === PAWN && this._board[move.to + 1]?.color === them) {
            this._epSquare = epSquare;
            this._hash ^= this._epKey();
          } else {
            this._epSquare = EMPTY;
          }
        } else {
          this._epSquare = EMPTY;
        }
        if (move.piece === PAWN) {
          this._halfMoves = 0;
        } else if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
          this._halfMoves = 0;
        } else {
          this._halfMoves++;
        }
        if (us === BLACK) {
          this._moveNumber++;
        }
        this._turn = them;
        this._hash ^= SIDE_KEY;
      }
      undo() {
        const hash = this._hash;
        const move = this._undoMove();
        if (move) {
          const prettyMove = new Move(this, move);
          this._decPositionCount(hash);
          return prettyMove;
        }
        return null;
      }
      _undoMove() {
        const old = this._history.pop();
        if (old === void 0) {
          return null;
        }
        this._hash ^= this._epKey();
        this._hash ^= this._castlingKey();
        const move = old.move;
        this._kings = old.kings;
        this._turn = old.turn;
        this._castling = old.castling;
        this._epSquare = old.epSquare;
        this._halfMoves = old.halfMoves;
        this._moveNumber = old.moveNumber;
        this._hash ^= this._epKey();
        this._hash ^= this._castlingKey();
        this._hash ^= SIDE_KEY;
        const us = this._turn;
        const them = swapColor(us);
        if (move.flags & BITS.NULL_MOVE) {
          return move;
        }
        this._movePiece(move.to, move.from);
        if (move.piece) {
          this._clear(move.from);
          this._set(move.from, { type: move.piece, color: us });
        }
        if (move.captured) {
          if (move.flags & BITS.EP_CAPTURE) {
            let index;
            if (us === BLACK) {
              index = move.to - 16;
            } else {
              index = move.to + 16;
            }
            this._set(index, { type: PAWN, color: them });
          } else {
            this._set(move.to, { type: move.captured, color: them });
          }
        }
        if (move.flags & (BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE)) {
          let castlingTo, castlingFrom;
          if (move.flags & BITS.KSIDE_CASTLE) {
            castlingTo = move.to + 1;
            castlingFrom = move.to - 1;
          } else {
            castlingTo = move.to - 2;
            castlingFrom = move.to + 1;
          }
          this._movePiece(castlingFrom, castlingTo);
        }
        return move;
      }
      pgn({ newline = "\n", maxWidth = 0 } = {}) {
        const result = [];
        let headerExists = false;
        for (const i in this._header) {
          const headerTag = this._header[i];
          if (headerTag)
            result.push(`[${i} "${this._header[i]}"]` + newline);
          headerExists = true;
        }
        if (headerExists && this._history.length) {
          result.push(newline);
        }
        const appendComment = (moveString2) => {
          const comment = this._comments[this.fen()];
          if (typeof comment !== "undefined") {
            const delimiter = moveString2.length > 0 ? " " : "";
            moveString2 = `${moveString2}${delimiter}{${comment}}`;
          }
          return moveString2;
        };
        const reversedHistory = [];
        while (this._history.length > 0) {
          reversedHistory.push(this._undoMove());
        }
        const moves = [];
        let moveString = "";
        if (reversedHistory.length === 0) {
          moves.push(appendComment(""));
        }
        while (reversedHistory.length > 0) {
          moveString = appendComment(moveString);
          const move = reversedHistory.pop();
          if (!move) {
            break;
          }
          if (!this._history.length && move.color === "b") {
            const prefix = `${this._moveNumber}. ...`;
            moveString = moveString ? `${moveString} ${prefix}` : prefix;
          } else if (move.color === "w") {
            if (moveString.length) {
              moves.push(moveString);
            }
            moveString = this._moveNumber + ".";
          }
          moveString = moveString + " " + this._moveToSan(move, this._moves({ legal: true }));
          this._makeMove(move);
        }
        if (moveString.length) {
          moves.push(appendComment(moveString));
        }
        moves.push(this._header.Result || "*");
        if (maxWidth === 0) {
          return result.join("") + moves.join(" ");
        }
        const strip = function() {
          if (result.length > 0 && result[result.length - 1] === " ") {
            result.pop();
            return true;
          }
          return false;
        };
        const wrapComment = function(width, move) {
          for (const token of move.split(" ")) {
            if (!token) {
              continue;
            }
            if (width + token.length > maxWidth) {
              while (strip()) {
                width--;
              }
              result.push(newline);
              width = 0;
            }
            result.push(token);
            width += token.length;
            result.push(" ");
            width++;
          }
          if (strip()) {
            width--;
          }
          return width;
        };
        let currentWidth = 0;
        for (let i = 0; i < moves.length; i++) {
          if (currentWidth + moves[i].length > maxWidth) {
            if (moves[i].includes("{")) {
              currentWidth = wrapComment(currentWidth, moves[i]);
              continue;
            }
          }
          if (currentWidth + moves[i].length > maxWidth && i !== 0) {
            if (result[result.length - 1] === " ") {
              result.pop();
            }
            result.push(newline);
            currentWidth = 0;
          } else if (i !== 0) {
            result.push(" ");
            currentWidth++;
          }
          result.push(moves[i]);
          currentWidth += moves[i].length;
        }
        return result.join("");
      }
      /**
       * @deprecated Use `setHeader` and `getHeaders` instead. This method will return null header tags (which is not what you want)
       */
      header(...args) {
        for (let i = 0; i < args.length; i += 2) {
          if (typeof args[i] === "string" && typeof args[i + 1] === "string") {
            this._header[args[i]] = args[i + 1];
          }
        }
        return this._header;
      }
      // TODO: value validation per spec
      setHeader(key, value2) {
        this._header[key] = value2 ?? SEVEN_TAG_ROSTER[key] ?? null;
        return this.getHeaders();
      }
      removeHeader(key) {
        if (key in this._header) {
          this._header[key] = SEVEN_TAG_ROSTER[key] || null;
          return true;
        }
        return false;
      }
      // return only non-null headers (omit placemarker nulls)
      getHeaders() {
        const nonNullHeaders = {};
        for (const [key, value2] of Object.entries(this._header)) {
          if (value2 !== null) {
            nonNullHeaders[key] = value2;
          }
        }
        return nonNullHeaders;
      }
      loadPgn(pgn2, { strict = false, newlineChar = "\r?\n" } = {}) {
        if (newlineChar !== "\r?\n") {
          pgn2 = pgn2.replace(new RegExp(newlineChar, "g"), "\n");
        }
        const parsedPgn = peg$parse(pgn2);
        this.reset();
        const headers = parsedPgn.headers;
        let fen = "";
        for (const key in headers) {
          if (key.toLowerCase() === "fen") {
            fen = headers[key];
          }
          this.header(key, headers[key]);
        }
        if (!strict) {
          if (fen) {
            this.load(fen, { preserveHeaders: true });
          }
        } else {
          if (headers["SetUp"] === "1") {
            if (!("FEN" in headers)) {
              throw new Error("Invalid PGN: FEN tag must be supplied with SetUp tag");
            }
            this.load(headers["FEN"], { preserveHeaders: true });
          }
        }
        let node2 = parsedPgn.root;
        while (node2) {
          if (node2.move) {
            const move = this._moveFromSan(node2.move, strict);
            if (move == null) {
              throw new Error(`Invalid move in PGN: ${node2.move}`);
            } else {
              this._makeMove(move);
              this._incPositionCount();
            }
          }
          if (node2.comment !== void 0) {
            this._comments[this.fen()] = node2.comment;
          }
          node2 = node2.variations[0];
        }
        const result = parsedPgn.result;
        if (result && Object.keys(this._header).length && this._header["Result"] !== result) {
          this.setHeader("Result", result);
        }
      }
      /*
       * Convert a move from 0x88 coordinates to Standard Algebraic Notation
       * (SAN)
       *
       * @param {boolean} strict Use the strict SAN parser. It will throw errors
       * on overly disambiguated moves (see below):
       *
       * r1bqkbnr/ppp2ppp/2n5/1B1pP3/4P3/8/PPPP2PP/RNBQK1NR b KQkq - 2 4
       * 4. ... Nge7 is overly disambiguated because the knight on c6 is pinned
       * 4. ... Ne7 is technically the valid SAN
       */
      _moveToSan(move, moves) {
        let output = "";
        if (move.flags & BITS.KSIDE_CASTLE) {
          output = "O-O";
        } else if (move.flags & BITS.QSIDE_CASTLE) {
          output = "O-O-O";
        } else if (move.flags & BITS.NULL_MOVE) {
          return SAN_NULLMOVE;
        } else {
          if (move.piece !== PAWN) {
            const disambiguator = getDisambiguator(move, moves);
            output += move.piece.toUpperCase() + disambiguator;
          }
          if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
            if (move.piece === PAWN) {
              output += algebraic(move.from)[0];
            }
            output += "x";
          }
          output += algebraic(move.to);
          if (move.promotion) {
            output += "=" + move.promotion.toUpperCase();
          }
        }
        this._makeMove(move);
        if (this.isCheck()) {
          if (this.isCheckmate()) {
            output += "#";
          } else {
            output += "+";
          }
        }
        this._undoMove();
        return output;
      }
      // convert a move from Standard Algebraic Notation (SAN) to 0x88 coordinates
      _moveFromSan(move, strict = false) {
        let cleanMove = strippedSan(move);
        if (!strict) {
          if (cleanMove === "0-0") {
            cleanMove = "O-O";
          } else if (cleanMove === "0-0-0") {
            cleanMove = "O-O-O";
          }
        }
        if (cleanMove == SAN_NULLMOVE) {
          const res = {
            color: this._turn,
            from: 0,
            to: 0,
            piece: "k",
            flags: BITS.NULL_MOVE
          };
          return res;
        }
        let pieceType = inferPieceType(cleanMove);
        let moves = this._moves({ legal: true, piece: pieceType });
        for (let i = 0, len = moves.length; i < len; i++) {
          if (cleanMove === strippedSan(this._moveToSan(moves[i], moves))) {
            return moves[i];
          }
        }
        if (strict) {
          return null;
        }
        let piece = void 0;
        let matches = void 0;
        let from = void 0;
        let to = void 0;
        let promotion = void 0;
        let overlyDisambiguated = false;
        matches = cleanMove.match(/([pnbrqkPNBRQK])?([a-h][1-8])x?-?([a-h][1-8])([qrbnQRBN])?/);
        if (matches) {
          piece = matches[1];
          from = matches[2];
          to = matches[3];
          promotion = matches[4];
          if (from.length == 1) {
            overlyDisambiguated = true;
          }
        } else {
          matches = cleanMove.match(/([pnbrqkPNBRQK])?([a-h]?[1-8]?)x?-?([a-h][1-8])([qrbnQRBN])?/);
          if (matches) {
            piece = matches[1];
            from = matches[2];
            to = matches[3];
            promotion = matches[4];
            if (from.length == 1) {
              overlyDisambiguated = true;
            }
          }
        }
        pieceType = inferPieceType(cleanMove);
        moves = this._moves({
          legal: true,
          piece: piece ? piece : pieceType
        });
        if (!to) {
          return null;
        }
        for (let i = 0, len = moves.length; i < len; i++) {
          if (!from) {
            if (cleanMove === strippedSan(this._moveToSan(moves[i], moves)).replace("x", "")) {
              return moves[i];
            }
          } else if ((!piece || piece.toLowerCase() == moves[i].piece) && Ox88[from] == moves[i].from && Ox88[to] == moves[i].to && (!promotion || promotion.toLowerCase() == moves[i].promotion)) {
            return moves[i];
          } else if (overlyDisambiguated) {
            const square = algebraic(moves[i].from);
            if ((!piece || piece.toLowerCase() == moves[i].piece) && Ox88[to] == moves[i].to && (from == square[0] || from == square[1]) && (!promotion || promotion.toLowerCase() == moves[i].promotion)) {
              return moves[i];
            }
          }
        }
        return null;
      }
      ascii() {
        let s = "   +------------------------+\n";
        for (let i = Ox88.a8; i <= Ox88.h1; i++) {
          if (file(i) === 0) {
            s += " " + "87654321"[rank(i)] + " |";
          }
          if (this._board[i]) {
            const piece = this._board[i].type;
            const color = this._board[i].color;
            const symbol = color === WHITE ? piece.toUpperCase() : piece.toLowerCase();
            s += " " + symbol + " ";
          } else {
            s += " . ";
          }
          if (i + 1 & 136) {
            s += "|\n";
            i += 8;
          }
        }
        s += "   +------------------------+\n";
        s += "     a  b  c  d  e  f  g  h";
        return s;
      }
      perft(depth) {
        const moves = this._moves({ legal: false });
        let nodes = 0;
        const color = this._turn;
        for (let i = 0, len = moves.length; i < len; i++) {
          this._makeMove(moves[i]);
          if (!this._isKingAttacked(color)) {
            if (depth - 1 > 0) {
              nodes += this.perft(depth - 1);
            } else {
              nodes++;
            }
          }
          this._undoMove();
        }
        return nodes;
      }
      setTurn(color) {
        if (this._turn == color) {
          return false;
        }
        this.move("--");
        return true;
      }
      turn() {
        return this._turn;
      }
      board() {
        const output = [];
        let row = [];
        for (let i = Ox88.a8; i <= Ox88.h1; i++) {
          if (this._board[i] == null) {
            row.push(null);
          } else {
            row.push({
              square: algebraic(i),
              type: this._board[i].type,
              color: this._board[i].color
            });
          }
          if (i + 1 & 136) {
            output.push(row);
            row = [];
            i += 8;
          }
        }
        return output;
      }
      squareColor(square) {
        if (square in Ox88) {
          const sq = Ox88[square];
          return (rank(sq) + file(sq)) % 2 === 0 ? "light" : "dark";
        }
        return null;
      }
      history({ verbose = false } = {}) {
        const reversedHistory = [];
        const moveHistory = [];
        while (this._history.length > 0) {
          reversedHistory.push(this._undoMove());
        }
        while (true) {
          const move = reversedHistory.pop();
          if (!move) {
            break;
          }
          if (verbose) {
            moveHistory.push(new Move(this, move));
          } else {
            moveHistory.push(this._moveToSan(move, this._moves()));
          }
          this._makeMove(move);
        }
        return moveHistory;
      }
      /*
       * Keeps track of position occurrence counts for the purpose of repetition
       * checking. Old positions are removed from the map if their counts are reduced to 0.
       */
      _getPositionCount(hash) {
        return this._positionCount.get(hash) ?? 0;
      }
      _incPositionCount() {
        this._positionCount.set(this._hash, (this._positionCount.get(this._hash) ?? 0) + 1);
      }
      _decPositionCount(hash) {
        const currentCount = this._positionCount.get(hash) ?? 0;
        if (currentCount === 1) {
          this._positionCount.delete(hash);
        } else {
          this._positionCount.set(hash, currentCount - 1);
        }
      }
      _pruneComments() {
        const reversedHistory = [];
        const currentComments = {};
        const copyComment = (fen) => {
          if (fen in this._comments) {
            currentComments[fen] = this._comments[fen];
          }
        };
        while (this._history.length > 0) {
          reversedHistory.push(this._undoMove());
        }
        copyComment(this.fen());
        while (true) {
          const move = reversedHistory.pop();
          if (!move) {
            break;
          }
          this._makeMove(move);
          copyComment(this.fen());
        }
        this._comments = currentComments;
      }
      getComment() {
        return this._comments[this.fen()];
      }
      setComment(comment) {
        this._comments[this.fen()] = comment.replace("{", "[").replace("}", "]");
      }
      /**
       * @deprecated Renamed to `removeComment` for consistency
       */
      deleteComment() {
        return this.removeComment();
      }
      removeComment() {
        const comment = this._comments[this.fen()];
        delete this._comments[this.fen()];
        return comment;
      }
      getComments() {
        this._pruneComments();
        return Object.keys(this._comments).map((fen) => {
          return { fen, comment: this._comments[fen] };
        });
      }
      /**
       * @deprecated Renamed to `removeComments` for consistency
       */
      deleteComments() {
        return this.removeComments();
      }
      removeComments() {
        this._pruneComments();
        return Object.keys(this._comments).map((fen) => {
          const comment = this._comments[fen];
          delete this._comments[fen];
          return { fen, comment };
        });
      }
      setCastlingRights(color, rights) {
        for (const side of [KING, QUEEN]) {
          if (rights[side] !== void 0) {
            if (rights[side]) {
              this._castling[color] |= SIDES[side];
            } else {
              this._castling[color] &= ~SIDES[side];
            }
          }
        }
        this._updateCastlingRights();
        const result = this.getCastlingRights(color);
        return (rights[KING] === void 0 || rights[KING] === result[KING]) && (rights[QUEEN] === void 0 || rights[QUEEN] === result[QUEEN]);
      }
      getCastlingRights(color) {
        return {
          [KING]: (this._castling[color] & SIDES[KING]) !== 0,
          [QUEEN]: (this._castling[color] & SIDES[QUEEN]) !== 0
        };
      }
      moveNumber() {
        return this._moveNumber;
      }
    };
  }
});

// node_modules/engine.io-parser/build/esm/commons.js
var PACKET_TYPES, PACKET_TYPES_REVERSE, ERROR_PACKET;
var init_commons = __esm({
  "node_modules/engine.io-parser/build/esm/commons.js"() {
    PACKET_TYPES = /* @__PURE__ */ Object.create(null);
    PACKET_TYPES["open"] = "0";
    PACKET_TYPES["close"] = "1";
    PACKET_TYPES["ping"] = "2";
    PACKET_TYPES["pong"] = "3";
    PACKET_TYPES["message"] = "4";
    PACKET_TYPES["upgrade"] = "5";
    PACKET_TYPES["noop"] = "6";
    PACKET_TYPES_REVERSE = /* @__PURE__ */ Object.create(null);
    Object.keys(PACKET_TYPES).forEach((key) => {
      PACKET_TYPES_REVERSE[PACKET_TYPES[key]] = key;
    });
    ERROR_PACKET = { type: "error", data: "parser error" };
  }
});

// node_modules/engine.io-parser/build/esm/encodePacket.browser.js
function toArray(data) {
  if (data instanceof Uint8Array) {
    return data;
  } else if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  } else {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
}
function encodePacketToBinary(packet, callback) {
  if (withNativeBlob && packet.data instanceof Blob) {
    return packet.data.arrayBuffer().then(toArray).then(callback);
  } else if (withNativeArrayBuffer && (packet.data instanceof ArrayBuffer || isView(packet.data))) {
    return callback(toArray(packet.data));
  }
  encodePacket(packet, false, (encoded) => {
    if (!TEXT_ENCODER) {
      TEXT_ENCODER = new TextEncoder();
    }
    callback(TEXT_ENCODER.encode(encoded));
  });
}
var withNativeBlob, withNativeArrayBuffer, isView, encodePacket, encodeBlobAsBase64, TEXT_ENCODER;
var init_encodePacket_browser = __esm({
  "node_modules/engine.io-parser/build/esm/encodePacket.browser.js"() {
    init_commons();
    withNativeBlob = typeof Blob === "function" || typeof Blob !== "undefined" && Object.prototype.toString.call(Blob) === "[object BlobConstructor]";
    withNativeArrayBuffer = typeof ArrayBuffer === "function";
    isView = (obj) => {
      return typeof ArrayBuffer.isView === "function" ? ArrayBuffer.isView(obj) : obj && obj.buffer instanceof ArrayBuffer;
    };
    encodePacket = ({ type, data }, supportsBinary, callback) => {
      if (withNativeBlob && data instanceof Blob) {
        if (supportsBinary) {
          return callback(data);
        } else {
          return encodeBlobAsBase64(data, callback);
        }
      } else if (withNativeArrayBuffer && (data instanceof ArrayBuffer || isView(data))) {
        if (supportsBinary) {
          return callback(data);
        } else {
          return encodeBlobAsBase64(new Blob([data]), callback);
        }
      }
      return callback(PACKET_TYPES[type] + (data || ""));
    };
    encodeBlobAsBase64 = (data, callback) => {
      const fileReader = new FileReader();
      fileReader.onload = function() {
        const content = fileReader.result.split(",")[1];
        callback("b" + (content || ""));
      };
      return fileReader.readAsDataURL(data);
    };
  }
});

// node_modules/engine.io-parser/build/esm/contrib/base64-arraybuffer.js
var chars, lookup, decode;
var init_base64_arraybuffer = __esm({
  "node_modules/engine.io-parser/build/esm/contrib/base64-arraybuffer.js"() {
    chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    lookup = typeof Uint8Array === "undefined" ? [] : new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) {
      lookup[chars.charCodeAt(i)] = i;
    }
    decode = (base64) => {
      let bufferLength = base64.length * 0.75, len = base64.length, i, p = 0, encoded1, encoded2, encoded3, encoded4;
      if (base64[base64.length - 1] === "=") {
        bufferLength--;
        if (base64[base64.length - 2] === "=") {
          bufferLength--;
        }
      }
      const arraybuffer = new ArrayBuffer(bufferLength), bytes = new Uint8Array(arraybuffer);
      for (i = 0; i < len; i += 4) {
        encoded1 = lookup[base64.charCodeAt(i)];
        encoded2 = lookup[base64.charCodeAt(i + 1)];
        encoded3 = lookup[base64.charCodeAt(i + 2)];
        encoded4 = lookup[base64.charCodeAt(i + 3)];
        bytes[p++] = encoded1 << 2 | encoded2 >> 4;
        bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
        bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
      }
      return arraybuffer;
    };
  }
});

// node_modules/engine.io-parser/build/esm/decodePacket.browser.js
var withNativeArrayBuffer2, decodePacket, decodeBase64Packet, mapBinary;
var init_decodePacket_browser = __esm({
  "node_modules/engine.io-parser/build/esm/decodePacket.browser.js"() {
    init_commons();
    init_base64_arraybuffer();
    withNativeArrayBuffer2 = typeof ArrayBuffer === "function";
    decodePacket = (encodedPacket, binaryType) => {
      if (typeof encodedPacket !== "string") {
        return {
          type: "message",
          data: mapBinary(encodedPacket, binaryType)
        };
      }
      const type = encodedPacket.charAt(0);
      if (type === "b") {
        return {
          type: "message",
          data: decodeBase64Packet(encodedPacket.substring(1), binaryType)
        };
      }
      const packetType = PACKET_TYPES_REVERSE[type];
      if (!packetType) {
        return ERROR_PACKET;
      }
      return encodedPacket.length > 1 ? {
        type: PACKET_TYPES_REVERSE[type],
        data: encodedPacket.substring(1)
      } : {
        type: PACKET_TYPES_REVERSE[type]
      };
    };
    decodeBase64Packet = (data, binaryType) => {
      if (withNativeArrayBuffer2) {
        const decoded = decode(data);
        return mapBinary(decoded, binaryType);
      } else {
        return { base64: true, data };
      }
    };
    mapBinary = (data, binaryType) => {
      switch (binaryType) {
        case "blob":
          if (data instanceof Blob) {
            return data;
          } else {
            return new Blob([data]);
          }
        case "arraybuffer":
        default:
          if (data instanceof ArrayBuffer) {
            return data;
          } else {
            return data.buffer;
          }
      }
    };
  }
});

// node_modules/engine.io-parser/build/esm/index.js
function createPacketEncoderStream() {
  return new TransformStream({
    transform(packet, controller) {
      encodePacketToBinary(packet, (encodedPacket) => {
        const payloadLength = encodedPacket.length;
        let header;
        if (payloadLength < 126) {
          header = new Uint8Array(1);
          new DataView(header.buffer).setUint8(0, payloadLength);
        } else if (payloadLength < 65536) {
          header = new Uint8Array(3);
          const view = new DataView(header.buffer);
          view.setUint8(0, 126);
          view.setUint16(1, payloadLength);
        } else {
          header = new Uint8Array(9);
          const view = new DataView(header.buffer);
          view.setUint8(0, 127);
          view.setBigUint64(1, BigInt(payloadLength));
        }
        if (packet.data && typeof packet.data !== "string") {
          header[0] |= 128;
        }
        controller.enqueue(header);
        controller.enqueue(encodedPacket);
      });
    }
  });
}
function totalLength(chunks) {
  return chunks.reduce((acc, chunk) => acc + chunk.length, 0);
}
function concatChunks(chunks, size) {
  if (chunks[0].length === size) {
    return chunks.shift();
  }
  const buffer = new Uint8Array(size);
  let j = 0;
  for (let i = 0; i < size; i++) {
    buffer[i] = chunks[0][j++];
    if (j === chunks[0].length) {
      chunks.shift();
      j = 0;
    }
  }
  if (chunks.length && j < chunks[0].length) {
    chunks[0] = chunks[0].slice(j);
  }
  return buffer;
}
function createPacketDecoderStream(maxPayload, binaryType) {
  if (!TEXT_DECODER) {
    TEXT_DECODER = new TextDecoder();
  }
  const chunks = [];
  let state = 0;
  let expectedLength = -1;
  let isBinary2 = false;
  return new TransformStream({
    transform(chunk, controller) {
      chunks.push(chunk);
      while (true) {
        if (state === 0) {
          if (totalLength(chunks) < 1) {
            break;
          }
          const header = concatChunks(chunks, 1);
          isBinary2 = (header[0] & 128) === 128;
          expectedLength = header[0] & 127;
          if (expectedLength < 126) {
            state = 3;
          } else if (expectedLength === 126) {
            state = 1;
          } else {
            state = 2;
          }
        } else if (state === 1) {
          if (totalLength(chunks) < 2) {
            break;
          }
          const headerArray = concatChunks(chunks, 2);
          expectedLength = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length).getUint16(0);
          state = 3;
        } else if (state === 2) {
          if (totalLength(chunks) < 8) {
            break;
          }
          const headerArray = concatChunks(chunks, 8);
          const view = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length);
          const n = view.getUint32(0);
          if (n > Math.pow(2, 53 - 32) - 1) {
            controller.enqueue(ERROR_PACKET);
            break;
          }
          expectedLength = n * Math.pow(2, 32) + view.getUint32(4);
          state = 3;
        } else {
          if (totalLength(chunks) < expectedLength) {
            break;
          }
          const data = concatChunks(chunks, expectedLength);
          controller.enqueue(decodePacket(isBinary2 ? data : TEXT_DECODER.decode(data), binaryType));
          state = 0;
        }
        if (expectedLength === 0 || expectedLength > maxPayload) {
          controller.enqueue(ERROR_PACKET);
          break;
        }
      }
    }
  });
}
var SEPARATOR, encodePayload, decodePayload, TEXT_DECODER, protocol;
var init_esm = __esm({
  "node_modules/engine.io-parser/build/esm/index.js"() {
    init_encodePacket_browser();
    init_decodePacket_browser();
    init_commons();
    SEPARATOR = String.fromCharCode(30);
    encodePayload = (packets, callback) => {
      const length = packets.length;
      const encodedPackets = new Array(length);
      let count = 0;
      packets.forEach((packet, i) => {
        encodePacket(packet, false, (encodedPacket) => {
          encodedPackets[i] = encodedPacket;
          if (++count === length) {
            callback(encodedPackets.join(SEPARATOR));
          }
        });
      });
    };
    decodePayload = (encodedPayload, binaryType) => {
      const encodedPackets = encodedPayload.split(SEPARATOR);
      const packets = [];
      for (let i = 0; i < encodedPackets.length; i++) {
        const decodedPacket = decodePacket(encodedPackets[i], binaryType);
        packets.push(decodedPacket);
        if (decodedPacket.type === "error") {
          break;
        }
      }
      return packets;
    };
    protocol = 4;
  }
});

// node_modules/@socket.io/component-emitter/lib/esm/index.js
function Emitter(obj) {
  if (obj) return mixin(obj);
}
function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}
var init_esm2 = __esm({
  "node_modules/@socket.io/component-emitter/lib/esm/index.js"() {
    Emitter.prototype.on = Emitter.prototype.addEventListener = function(event, fn) {
      this._callbacks = this._callbacks || {};
      (this._callbacks["$" + event] = this._callbacks["$" + event] || []).push(fn);
      return this;
    };
    Emitter.prototype.once = function(event, fn) {
      function on2() {
        this.off(event, on2);
        fn.apply(this, arguments);
      }
      on2.fn = fn;
      this.on(event, on2);
      return this;
    };
    Emitter.prototype.off = Emitter.prototype.removeListener = Emitter.prototype.removeAllListeners = Emitter.prototype.removeEventListener = function(event, fn) {
      this._callbacks = this._callbacks || {};
      if (0 == arguments.length) {
        this._callbacks = {};
        return this;
      }
      var callbacks = this._callbacks["$" + event];
      if (!callbacks) return this;
      if (1 == arguments.length) {
        delete this._callbacks["$" + event];
        return this;
      }
      var cb;
      for (var i = 0; i < callbacks.length; i++) {
        cb = callbacks[i];
        if (cb === fn || cb.fn === fn) {
          callbacks.splice(i, 1);
          break;
        }
      }
      if (callbacks.length === 0) {
        delete this._callbacks["$" + event];
      }
      return this;
    };
    Emitter.prototype.emit = function(event) {
      this._callbacks = this._callbacks || {};
      var args = new Array(arguments.length - 1), callbacks = this._callbacks["$" + event];
      for (var i = 1; i < arguments.length; i++) {
        args[i - 1] = arguments[i];
      }
      if (callbacks) {
        callbacks = callbacks.slice(0);
        for (var i = 0, len = callbacks.length; i < len; ++i) {
          callbacks[i].apply(this, args);
        }
      }
      return this;
    };
    Emitter.prototype.emitReserved = Emitter.prototype.emit;
    Emitter.prototype.listeners = function(event) {
      this._callbacks = this._callbacks || {};
      return this._callbacks["$" + event] || [];
    };
    Emitter.prototype.hasListeners = function(event) {
      return !!this.listeners(event).length;
    };
  }
});

// node_modules/engine.io-client/build/esm/globals.js
function createCookieJar() {
}
var nextTick, globalThisShim, defaultBinaryType;
var init_globals = __esm({
  "node_modules/engine.io-client/build/esm/globals.js"() {
    nextTick = (() => {
      const isPromiseAvailable = typeof Promise === "function" && typeof Promise.resolve === "function";
      if (isPromiseAvailable) {
        return (cb) => Promise.resolve().then(cb);
      } else {
        return (cb, setTimeoutFn) => setTimeoutFn(cb, 0);
      }
    })();
    globalThisShim = (() => {
      if (typeof self !== "undefined") {
        return self;
      } else if (typeof window !== "undefined") {
        return window;
      } else {
        return Function("return this")();
      }
    })();
    defaultBinaryType = "arraybuffer";
  }
});

// node_modules/engine.io-client/build/esm/util.js
function pick(obj, ...attr) {
  return attr.reduce((acc, k) => {
    if (obj.hasOwnProperty(k)) {
      acc[k] = obj[k];
    }
    return acc;
  }, {});
}
function installTimerFunctions(obj, opts) {
  if (opts.useNativeTimers) {
    obj.setTimeoutFn = NATIVE_SET_TIMEOUT.bind(globalThisShim);
    obj.clearTimeoutFn = NATIVE_CLEAR_TIMEOUT.bind(globalThisShim);
  } else {
    obj.setTimeoutFn = globalThisShim.setTimeout.bind(globalThisShim);
    obj.clearTimeoutFn = globalThisShim.clearTimeout.bind(globalThisShim);
  }
}
function byteLength(obj) {
  if (typeof obj === "string") {
    return utf8Length(obj);
  }
  return Math.ceil((obj.byteLength || obj.size) * BASE64_OVERHEAD);
}
function utf8Length(str) {
  let c = 0, length = 0;
  for (let i = 0, l = str.length; i < l; i++) {
    c = str.charCodeAt(i);
    if (c < 128) {
      length += 1;
    } else if (c < 2048) {
      length += 2;
    } else if (c < 55296 || c >= 57344) {
      length += 3;
    } else {
      i++;
      length += 4;
    }
  }
  return length;
}
function randomString() {
  return Date.now().toString(36).substring(3) + Math.random().toString(36).substring(2, 5);
}
var NATIVE_SET_TIMEOUT, NATIVE_CLEAR_TIMEOUT, BASE64_OVERHEAD;
var init_util = __esm({
  "node_modules/engine.io-client/build/esm/util.js"() {
    init_globals();
    NATIVE_SET_TIMEOUT = globalThisShim.setTimeout;
    NATIVE_CLEAR_TIMEOUT = globalThisShim.clearTimeout;
    BASE64_OVERHEAD = 1.33;
  }
});

// node_modules/engine.io-client/build/esm/contrib/parseqs.js
function encode(obj) {
  let str = "";
  for (let i in obj) {
    if (obj.hasOwnProperty(i)) {
      if (str.length)
        str += "&";
      str += encodeURIComponent(i) + "=" + encodeURIComponent(obj[i]);
    }
  }
  return str;
}
function decode2(qs) {
  let qry = {};
  let pairs = qs.split("&");
  for (let i = 0, l = pairs.length; i < l; i++) {
    let pair = pairs[i].split("=");
    qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
  }
  return qry;
}
var init_parseqs = __esm({
  "node_modules/engine.io-client/build/esm/contrib/parseqs.js"() {
  }
});

// node_modules/engine.io-client/build/esm/transport.js
var TransportError, Transport;
var init_transport = __esm({
  "node_modules/engine.io-client/build/esm/transport.js"() {
    init_esm();
    init_esm2();
    init_util();
    init_parseqs();
    TransportError = class extends Error {
      constructor(reason, description, context) {
        super(reason);
        this.description = description;
        this.context = context;
        this.type = "TransportError";
      }
    };
    Transport = class extends Emitter {
      /**
       * Transport abstract constructor.
       *
       * @param {Object} opts - options
       * @protected
       */
      constructor(opts) {
        super();
        this.writable = false;
        installTimerFunctions(this, opts);
        this.opts = opts;
        this.query = opts.query;
        this.socket = opts.socket;
        this.supportsBinary = !opts.forceBase64;
      }
      /**
       * Emits an error.
       *
       * @param {String} reason
       * @param description
       * @param context - the error context
       * @return {Transport} for chaining
       * @protected
       */
      onError(reason, description, context) {
        super.emitReserved("error", new TransportError(reason, description, context));
        return this;
      }
      /**
       * Opens the transport.
       */
      open() {
        this.readyState = "opening";
        this.doOpen();
        return this;
      }
      /**
       * Closes the transport.
       */
      close() {
        if (this.readyState === "opening" || this.readyState === "open") {
          this.doClose();
          this.onClose();
        }
        return this;
      }
      /**
       * Sends multiple packets.
       *
       * @param {Array} packets
       */
      send(packets) {
        if (this.readyState === "open") {
          this.write(packets);
        } else {
        }
      }
      /**
       * Called upon open
       *
       * @protected
       */
      onOpen() {
        this.readyState = "open";
        this.writable = true;
        super.emitReserved("open");
      }
      /**
       * Called with data.
       *
       * @param {String} data
       * @protected
       */
      onData(data) {
        const packet = decodePacket(data, this.socket.binaryType);
        this.onPacket(packet);
      }
      /**
       * Called with a decoded packet.
       *
       * @protected
       */
      onPacket(packet) {
        super.emitReserved("packet", packet);
      }
      /**
       * Called upon close.
       *
       * @protected
       */
      onClose(details) {
        this.readyState = "closed";
        super.emitReserved("close", details);
      }
      /**
       * Pauses the transport, in order not to lose packets during an upgrade.
       *
       * @param onPause
       */
      pause(onPause) {
      }
      createUri(schema, query = {}) {
        return schema + "://" + this._hostname() + this._port() + this.opts.path + this._query(query);
      }
      _hostname() {
        const hostname = this.opts.hostname;
        return hostname.indexOf(":") === -1 ? hostname : "[" + hostname + "]";
      }
      _port() {
        if (this.opts.port && (this.opts.secure && Number(this.opts.port) !== 443 || !this.opts.secure && Number(this.opts.port) !== 80)) {
          return ":" + this.opts.port;
        } else {
          return "";
        }
      }
      _query(query) {
        const encodedQuery = encode(query);
        return encodedQuery.length ? "?" + encodedQuery : "";
      }
    };
  }
});

// node_modules/engine.io-client/build/esm/transports/polling.js
var Polling;
var init_polling = __esm({
  "node_modules/engine.io-client/build/esm/transports/polling.js"() {
    init_transport();
    init_util();
    init_esm();
    Polling = class extends Transport {
      constructor() {
        super(...arguments);
        this._polling = false;
      }
      get name() {
        return "polling";
      }
      /**
       * Opens the socket (triggers polling). We write a PING message to determine
       * when the transport is open.
       *
       * @protected
       */
      doOpen() {
        this._poll();
      }
      /**
       * Pauses polling.
       *
       * @param {Function} onPause - callback upon buffers are flushed and transport is paused
       * @package
       */
      pause(onPause) {
        this.readyState = "pausing";
        const pause = () => {
          this.readyState = "paused";
          onPause();
        };
        if (this._polling || !this.writable) {
          let total = 0;
          if (this._polling) {
            total++;
            this.once("pollComplete", function() {
              --total || pause();
            });
          }
          if (!this.writable) {
            total++;
            this.once("drain", function() {
              --total || pause();
            });
          }
        } else {
          pause();
        }
      }
      /**
       * Starts polling cycle.
       *
       * @private
       */
      _poll() {
        this._polling = true;
        this.doPoll();
        this.emitReserved("poll");
      }
      /**
       * Overloads onData to detect payloads.
       *
       * @protected
       */
      onData(data) {
        const callback = (packet) => {
          if ("opening" === this.readyState && packet.type === "open") {
            this.onOpen();
          }
          if ("close" === packet.type) {
            this.onClose({ description: "transport closed by the server" });
            return false;
          }
          this.onPacket(packet);
        };
        decodePayload(data, this.socket.binaryType).forEach(callback);
        if ("closed" !== this.readyState) {
          this._polling = false;
          this.emitReserved("pollComplete");
          if ("open" === this.readyState) {
            this._poll();
          } else {
          }
        }
      }
      /**
       * For polling, send a close packet.
       *
       * @protected
       */
      doClose() {
        const close = () => {
          this.write([{ type: "close" }]);
        };
        if ("open" === this.readyState) {
          close();
        } else {
          this.once("open", close);
        }
      }
      /**
       * Writes a packets payload.
       *
       * @param {Array} packets - data packets
       * @protected
       */
      write(packets) {
        this.writable = false;
        encodePayload(packets, (data) => {
          this.doWrite(data, () => {
            this.writable = true;
            this.emitReserved("drain");
          });
        });
      }
      /**
       * Generates uri for connection.
       *
       * @private
       */
      uri() {
        const schema = this.opts.secure ? "https" : "http";
        const query = this.query || {};
        if (false !== this.opts.timestampRequests) {
          query[this.opts.timestampParam] = randomString();
        }
        if (!this.supportsBinary && !query.sid) {
          query.b64 = 1;
        }
        return this.createUri(schema, query);
      }
    };
  }
});

// node_modules/engine.io-client/build/esm/contrib/has-cors.js
var value, hasCORS;
var init_has_cors = __esm({
  "node_modules/engine.io-client/build/esm/contrib/has-cors.js"() {
    value = false;
    try {
      value = typeof XMLHttpRequest !== "undefined" && "withCredentials" in new XMLHttpRequest();
    } catch (err) {
    }
    hasCORS = value;
  }
});

// node_modules/engine.io-client/build/esm/transports/polling-xhr.js
function empty() {
}
function unloadHandler() {
  for (let i in Request.requests) {
    if (Request.requests.hasOwnProperty(i)) {
      Request.requests[i].abort();
    }
  }
}
function newRequest(opts) {
  const xdomain = opts.xdomain;
  try {
    if ("undefined" !== typeof XMLHttpRequest && (!xdomain || hasCORS)) {
      return new XMLHttpRequest();
    }
  } catch (e) {
  }
  if (!xdomain) {
    try {
      return new globalThisShim[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP");
    } catch (e) {
    }
  }
}
var BaseXHR, Request, hasXHR2, XHR;
var init_polling_xhr = __esm({
  "node_modules/engine.io-client/build/esm/transports/polling-xhr.js"() {
    init_polling();
    init_esm2();
    init_util();
    init_globals();
    init_has_cors();
    BaseXHR = class extends Polling {
      /**
       * XHR Polling constructor.
       *
       * @param {Object} opts
       * @package
       */
      constructor(opts) {
        super(opts);
        if (typeof location !== "undefined") {
          const isSSL = "https:" === location.protocol;
          let port = location.port;
          if (!port) {
            port = isSSL ? "443" : "80";
          }
          this.xd = typeof location !== "undefined" && opts.hostname !== location.hostname || port !== opts.port;
        }
      }
      /**
       * Sends data.
       *
       * @param {String} data to send.
       * @param {Function} called upon flush.
       * @private
       */
      doWrite(data, fn) {
        const req = this.request({
          method: "POST",
          data
        });
        req.on("success", fn);
        req.on("error", (xhrStatus, context) => {
          this.onError("xhr post error", xhrStatus, context);
        });
      }
      /**
       * Starts a poll cycle.
       *
       * @private
       */
      doPoll() {
        const req = this.request();
        req.on("data", this.onData.bind(this));
        req.on("error", (xhrStatus, context) => {
          this.onError("xhr poll error", xhrStatus, context);
        });
        this.pollXhr = req;
      }
    };
    Request = class _Request extends Emitter {
      /**
       * Request constructor
       *
       * @param {Object} options
       * @package
       */
      constructor(createRequest, uri, opts) {
        super();
        this.createRequest = createRequest;
        installTimerFunctions(this, opts);
        this._opts = opts;
        this._method = opts.method || "GET";
        this._uri = uri;
        this._data = void 0 !== opts.data ? opts.data : null;
        this._create();
      }
      /**
       * Creates the XHR object and sends the request.
       *
       * @private
       */
      _create() {
        var _a;
        const opts = pick(this._opts, "agent", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "autoUnref");
        opts.xdomain = !!this._opts.xd;
        const xhr = this._xhr = this.createRequest(opts);
        try {
          xhr.open(this._method, this._uri, true);
          try {
            if (this._opts.extraHeaders) {
              xhr.setDisableHeaderCheck && xhr.setDisableHeaderCheck(true);
              for (let i in this._opts.extraHeaders) {
                if (this._opts.extraHeaders.hasOwnProperty(i)) {
                  xhr.setRequestHeader(i, this._opts.extraHeaders[i]);
                }
              }
            }
          } catch (e) {
          }
          if ("POST" === this._method) {
            try {
              xhr.setRequestHeader("Content-type", "text/plain;charset=UTF-8");
            } catch (e) {
            }
          }
          try {
            xhr.setRequestHeader("Accept", "*/*");
          } catch (e) {
          }
          (_a = this._opts.cookieJar) === null || _a === void 0 ? void 0 : _a.addCookies(xhr);
          if ("withCredentials" in xhr) {
            xhr.withCredentials = this._opts.withCredentials;
          }
          if (this._opts.requestTimeout) {
            xhr.timeout = this._opts.requestTimeout;
          }
          xhr.onreadystatechange = () => {
            var _a2;
            if (xhr.readyState === 3) {
              (_a2 = this._opts.cookieJar) === null || _a2 === void 0 ? void 0 : _a2.parseCookies(
                // @ts-ignore
                xhr.getResponseHeader("set-cookie")
              );
            }
            if (4 !== xhr.readyState)
              return;
            if (200 === xhr.status || 1223 === xhr.status) {
              this._onLoad();
            } else {
              this.setTimeoutFn(() => {
                this._onError(typeof xhr.status === "number" ? xhr.status : 0);
              }, 0);
            }
          };
          xhr.send(this._data);
        } catch (e) {
          this.setTimeoutFn(() => {
            this._onError(e);
          }, 0);
          return;
        }
        if (typeof document !== "undefined") {
          this._index = _Request.requestsCount++;
          _Request.requests[this._index] = this;
        }
      }
      /**
       * Called upon error.
       *
       * @private
       */
      _onError(err) {
        this.emitReserved("error", err, this._xhr);
        this._cleanup(true);
      }
      /**
       * Cleans up house.
       *
       * @private
       */
      _cleanup(fromError) {
        if ("undefined" === typeof this._xhr || null === this._xhr) {
          return;
        }
        this._xhr.onreadystatechange = empty;
        if (fromError) {
          try {
            this._xhr.abort();
          } catch (e) {
          }
        }
        if (typeof document !== "undefined") {
          delete _Request.requests[this._index];
        }
        this._xhr = null;
      }
      /**
       * Called upon load.
       *
       * @private
       */
      _onLoad() {
        const data = this._xhr.responseText;
        if (data !== null) {
          this.emitReserved("data", data);
          this.emitReserved("success");
          this._cleanup();
        }
      }
      /**
       * Aborts the request.
       *
       * @package
       */
      abort() {
        this._cleanup();
      }
    };
    Request.requestsCount = 0;
    Request.requests = {};
    if (typeof document !== "undefined") {
      if (typeof attachEvent === "function") {
        attachEvent("onunload", unloadHandler);
      } else if (typeof addEventListener === "function") {
        const terminationEvent = "onpagehide" in globalThisShim ? "pagehide" : "unload";
        addEventListener(terminationEvent, unloadHandler, false);
      }
    }
    hasXHR2 = (function() {
      const xhr = newRequest({
        xdomain: false
      });
      return xhr && xhr.responseType !== null;
    })();
    XHR = class extends BaseXHR {
      constructor(opts) {
        super(opts);
        const forceBase64 = opts && opts.forceBase64;
        this.supportsBinary = hasXHR2 && !forceBase64;
      }
      request(opts = {}) {
        Object.assign(opts, { xd: this.xd }, this.opts);
        return new Request(newRequest, this.uri(), opts);
      }
    };
  }
});

// node_modules/engine.io-client/build/esm/transports/websocket.js
var isReactNative, BaseWS, WebSocketCtor, WS;
var init_websocket = __esm({
  "node_modules/engine.io-client/build/esm/transports/websocket.js"() {
    init_transport();
    init_util();
    init_esm();
    init_globals();
    isReactNative = typeof navigator !== "undefined" && typeof navigator.product === "string" && navigator.product.toLowerCase() === "reactnative";
    BaseWS = class extends Transport {
      get name() {
        return "websocket";
      }
      doOpen() {
        const uri = this.uri();
        const protocols = this.opts.protocols;
        const opts = isReactNative ? {} : pick(this.opts, "agent", "perMessageDeflate", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "localAddress", "protocolVersion", "origin", "maxPayload", "family", "checkServerIdentity");
        if (this.opts.extraHeaders) {
          opts.headers = this.opts.extraHeaders;
        }
        try {
          this.ws = this.createSocket(uri, protocols, opts);
        } catch (err) {
          return this.emitReserved("error", err);
        }
        this.ws.binaryType = this.socket.binaryType;
        this.addEventListeners();
      }
      /**
       * Adds event listeners to the socket
       *
       * @private
       */
      addEventListeners() {
        this.ws.onopen = () => {
          if (this.opts.autoUnref) {
            this.ws._socket.unref();
          }
          this.onOpen();
        };
        this.ws.onclose = (closeEvent) => this.onClose({
          description: "websocket connection closed",
          context: closeEvent
        });
        this.ws.onmessage = (ev) => this.onData(ev.data);
        this.ws.onerror = (e) => this.onError("websocket error", e);
      }
      write(packets) {
        this.writable = false;
        for (let i = 0; i < packets.length; i++) {
          const packet = packets[i];
          const lastPacket = i === packets.length - 1;
          encodePacket(packet, this.supportsBinary, (data) => {
            try {
              this.doWrite(packet, data);
            } catch (e) {
            }
            if (lastPacket) {
              nextTick(() => {
                this.writable = true;
                this.emitReserved("drain");
              }, this.setTimeoutFn);
            }
          });
        }
      }
      doClose() {
        if (typeof this.ws !== "undefined") {
          this.ws.onerror = () => {
          };
          this.ws.close();
          this.ws = null;
        }
      }
      /**
       * Generates uri for connection.
       *
       * @private
       */
      uri() {
        const schema = this.opts.secure ? "wss" : "ws";
        const query = this.query || {};
        if (this.opts.timestampRequests) {
          query[this.opts.timestampParam] = randomString();
        }
        if (!this.supportsBinary) {
          query.b64 = 1;
        }
        return this.createUri(schema, query);
      }
    };
    WebSocketCtor = globalThisShim.WebSocket || globalThisShim.MozWebSocket;
    WS = class extends BaseWS {
      createSocket(uri, protocols, opts) {
        return !isReactNative ? protocols ? new WebSocketCtor(uri, protocols) : new WebSocketCtor(uri) : new WebSocketCtor(uri, protocols, opts);
      }
      doWrite(_packet, data) {
        this.ws.send(data);
      }
    };
  }
});

// node_modules/engine.io-client/build/esm/transports/webtransport.js
var WT;
var init_webtransport = __esm({
  "node_modules/engine.io-client/build/esm/transports/webtransport.js"() {
    init_transport();
    init_globals();
    init_esm();
    WT = class extends Transport {
      get name() {
        return "webtransport";
      }
      doOpen() {
        try {
          this._transport = new WebTransport(this.createUri("https"), this.opts.transportOptions[this.name]);
        } catch (err) {
          return this.emitReserved("error", err);
        }
        this._transport.closed.then(() => {
          this.onClose();
        }).catch((err) => {
          this.onError("webtransport error", err);
        });
        this._transport.ready.then(() => {
          this._transport.createBidirectionalStream().then((stream) => {
            const decoderStream = createPacketDecoderStream(Number.MAX_SAFE_INTEGER, this.socket.binaryType);
            const reader = stream.readable.pipeThrough(decoderStream).getReader();
            const encoderStream = createPacketEncoderStream();
            encoderStream.readable.pipeTo(stream.writable);
            this._writer = encoderStream.writable.getWriter();
            const read = () => {
              reader.read().then(({ done, value: value2 }) => {
                if (done) {
                  return;
                }
                this.onPacket(value2);
                read();
              }).catch((err) => {
              });
            };
            read();
            const packet = { type: "open" };
            if (this.query.sid) {
              packet.data = `{"sid":"${this.query.sid}"}`;
            }
            this._writer.write(packet).then(() => this.onOpen());
          });
        });
      }
      write(packets) {
        this.writable = false;
        for (let i = 0; i < packets.length; i++) {
          const packet = packets[i];
          const lastPacket = i === packets.length - 1;
          this._writer.write(packet).then(() => {
            if (lastPacket) {
              nextTick(() => {
                this.writable = true;
                this.emitReserved("drain");
              }, this.setTimeoutFn);
            }
          });
        }
      }
      doClose() {
        var _a;
        (_a = this._transport) === null || _a === void 0 ? void 0 : _a.close();
      }
    };
  }
});

// node_modules/engine.io-client/build/esm/transports/index.js
var transports;
var init_transports = __esm({
  "node_modules/engine.io-client/build/esm/transports/index.js"() {
    init_polling_xhr();
    init_websocket();
    init_webtransport();
    transports = {
      websocket: WS,
      webtransport: WT,
      polling: XHR
    };
  }
});

// node_modules/engine.io-client/build/esm/contrib/parseuri.js
function parse(str) {
  if (str.length > 8e3) {
    throw "URI too long";
  }
  const src = str, b = str.indexOf("["), e = str.indexOf("]");
  if (b != -1 && e != -1) {
    str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ";") + str.substring(e, str.length);
  }
  let m = re.exec(str || ""), uri = {}, i = 14;
  while (i--) {
    uri[parts[i]] = m[i] || "";
  }
  if (b != -1 && e != -1) {
    uri.source = src;
    uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ":");
    uri.authority = uri.authority.replace("[", "").replace("]", "").replace(/;/g, ":");
    uri.ipv6uri = true;
  }
  uri.pathNames = pathNames(uri, uri["path"]);
  uri.queryKey = queryKey(uri, uri["query"]);
  return uri;
}
function pathNames(obj, path) {
  const regx = /\/{2,9}/g, names = path.replace(regx, "/").split("/");
  if (path.slice(0, 1) == "/" || path.length === 0) {
    names.splice(0, 1);
  }
  if (path.slice(-1) == "/") {
    names.splice(names.length - 1, 1);
  }
  return names;
}
function queryKey(uri, query) {
  const data = {};
  query.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function($0, $1, $2) {
    if ($1) {
      data[$1] = $2;
    }
  });
  return data;
}
var re, parts;
var init_parseuri = __esm({
  "node_modules/engine.io-client/build/esm/contrib/parseuri.js"() {
    re = /^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;
    parts = [
      "source",
      "protocol",
      "authority",
      "userInfo",
      "user",
      "password",
      "host",
      "port",
      "relative",
      "path",
      "directory",
      "file",
      "query",
      "anchor"
    ];
  }
});

// node_modules/engine.io-client/build/esm/socket.js
var withEventListeners, OFFLINE_EVENT_LISTENERS, SocketWithoutUpgrade, SocketWithUpgrade, Socket;
var init_socket = __esm({
  "node_modules/engine.io-client/build/esm/socket.js"() {
    init_transports();
    init_util();
    init_parseqs();
    init_parseuri();
    init_esm2();
    init_esm();
    init_globals();
    withEventListeners = typeof addEventListener === "function" && typeof removeEventListener === "function";
    OFFLINE_EVENT_LISTENERS = [];
    if (withEventListeners) {
      addEventListener("offline", () => {
        OFFLINE_EVENT_LISTENERS.forEach((listener) => listener());
      }, false);
    }
    SocketWithoutUpgrade = class _SocketWithoutUpgrade extends Emitter {
      /**
       * Socket constructor.
       *
       * @param {String|Object} uri - uri or options
       * @param {Object} opts - options
       */
      constructor(uri, opts) {
        super();
        this.binaryType = defaultBinaryType;
        this.writeBuffer = [];
        this._prevBufferLen = 0;
        this._pingInterval = -1;
        this._pingTimeout = -1;
        this._maxPayload = -1;
        this._pingTimeoutTime = Infinity;
        if (uri && "object" === typeof uri) {
          opts = uri;
          uri = null;
        }
        if (uri) {
          const parsedUri = parse(uri);
          opts.hostname = parsedUri.host;
          opts.secure = parsedUri.protocol === "https" || parsedUri.protocol === "wss";
          opts.port = parsedUri.port;
          if (parsedUri.query)
            opts.query = parsedUri.query;
        } else if (opts.host) {
          opts.hostname = parse(opts.host).host;
        }
        installTimerFunctions(this, opts);
        this.secure = null != opts.secure ? opts.secure : typeof location !== "undefined" && "https:" === location.protocol;
        if (opts.hostname && !opts.port) {
          opts.port = this.secure ? "443" : "80";
        }
        this.hostname = opts.hostname || (typeof location !== "undefined" ? location.hostname : "localhost");
        this.port = opts.port || (typeof location !== "undefined" && location.port ? location.port : this.secure ? "443" : "80");
        this.transports = [];
        this._transportsByName = {};
        opts.transports.forEach((t) => {
          const transportName = t.prototype.name;
          this.transports.push(transportName);
          this._transportsByName[transportName] = t;
        });
        this.opts = Object.assign({
          path: "/engine.io",
          agent: false,
          withCredentials: false,
          upgrade: true,
          timestampParam: "t",
          rememberUpgrade: false,
          addTrailingSlash: true,
          rejectUnauthorized: true,
          perMessageDeflate: {
            threshold: 1024
          },
          transportOptions: {},
          closeOnBeforeunload: false
        }, opts);
        this.opts.path = this.opts.path.replace(/\/$/, "") + (this.opts.addTrailingSlash ? "/" : "");
        if (typeof this.opts.query === "string") {
          this.opts.query = decode2(this.opts.query);
        }
        if (withEventListeners) {
          if (this.opts.closeOnBeforeunload) {
            this._beforeunloadEventListener = () => {
              if (this.transport) {
                this.transport.removeAllListeners();
                this.transport.close();
              }
            };
            addEventListener("beforeunload", this._beforeunloadEventListener, false);
          }
          if (this.hostname !== "localhost") {
            this._offlineEventListener = () => {
              this._onClose("transport close", {
                description: "network connection lost"
              });
            };
            OFFLINE_EVENT_LISTENERS.push(this._offlineEventListener);
          }
        }
        if (this.opts.withCredentials) {
          this._cookieJar = createCookieJar();
        }
        this._open();
      }
      /**
       * Creates transport of the given type.
       *
       * @param {String} name - transport name
       * @return {Transport}
       * @private
       */
      createTransport(name) {
        const query = Object.assign({}, this.opts.query);
        query.EIO = protocol;
        query.transport = name;
        if (this.id)
          query.sid = this.id;
        const opts = Object.assign({}, this.opts, {
          query,
          socket: this,
          hostname: this.hostname,
          secure: this.secure,
          port: this.port
        }, this.opts.transportOptions[name]);
        return new this._transportsByName[name](opts);
      }
      /**
       * Initializes transport to use and starts probe.
       *
       * @private
       */
      _open() {
        if (this.transports.length === 0) {
          this.setTimeoutFn(() => {
            this.emitReserved("error", "No transports available");
          }, 0);
          return;
        }
        const transportName = this.opts.rememberUpgrade && _SocketWithoutUpgrade.priorWebsocketSuccess && this.transports.indexOf("websocket") !== -1 ? "websocket" : this.transports[0];
        this.readyState = "opening";
        const transport = this.createTransport(transportName);
        transport.open();
        this.setTransport(transport);
      }
      /**
       * Sets the current transport. Disables the existing one (if any).
       *
       * @private
       */
      setTransport(transport) {
        if (this.transport) {
          this.transport.removeAllListeners();
        }
        this.transport = transport;
        transport.on("drain", this._onDrain.bind(this)).on("packet", this._onPacket.bind(this)).on("error", this._onError.bind(this)).on("close", (reason) => this._onClose("transport close", reason));
      }
      /**
       * Called when connection is deemed open.
       *
       * @private
       */
      onOpen() {
        this.readyState = "open";
        _SocketWithoutUpgrade.priorWebsocketSuccess = "websocket" === this.transport.name;
        this.emitReserved("open");
        this.flush();
      }
      /**
       * Handles a packet.
       *
       * @private
       */
      _onPacket(packet) {
        if ("opening" === this.readyState || "open" === this.readyState || "closing" === this.readyState) {
          this.emitReserved("packet", packet);
          this.emitReserved("heartbeat");
          switch (packet.type) {
            case "open":
              this.onHandshake(JSON.parse(packet.data));
              break;
            case "ping":
              this._sendPacket("pong");
              this.emitReserved("ping");
              this.emitReserved("pong");
              this._resetPingTimeout();
              break;
            case "error":
              const err = new Error("server error");
              err.code = packet.data;
              this._onError(err);
              break;
            case "message":
              this.emitReserved("data", packet.data);
              this.emitReserved("message", packet.data);
              break;
          }
        } else {
        }
      }
      /**
       * Called upon handshake completion.
       *
       * @param {Object} data - handshake obj
       * @private
       */
      onHandshake(data) {
        this.emitReserved("handshake", data);
        this.id = data.sid;
        this.transport.query.sid = data.sid;
        this._pingInterval = data.pingInterval;
        this._pingTimeout = data.pingTimeout;
        this._maxPayload = data.maxPayload;
        this.onOpen();
        if ("closed" === this.readyState)
          return;
        this._resetPingTimeout();
      }
      /**
       * Sets and resets ping timeout timer based on server pings.
       *
       * @private
       */
      _resetPingTimeout() {
        this.clearTimeoutFn(this._pingTimeoutTimer);
        const delay = this._pingInterval + this._pingTimeout;
        this._pingTimeoutTime = Date.now() + delay;
        this._pingTimeoutTimer = this.setTimeoutFn(() => {
          this._onClose("ping timeout");
        }, delay);
        if (this.opts.autoUnref) {
          this._pingTimeoutTimer.unref();
        }
      }
      /**
       * Called on `drain` event
       *
       * @private
       */
      _onDrain() {
        this.writeBuffer.splice(0, this._prevBufferLen);
        this._prevBufferLen = 0;
        if (0 === this.writeBuffer.length) {
          this.emitReserved("drain");
        } else {
          this.flush();
        }
      }
      /**
       * Flush write buffers.
       *
       * @private
       */
      flush() {
        if ("closed" !== this.readyState && this.transport.writable && !this.upgrading && this.writeBuffer.length) {
          const packets = this._getWritablePackets();
          this.transport.send(packets);
          this._prevBufferLen = packets.length;
          this.emitReserved("flush");
        }
      }
      /**
       * Ensure the encoded size of the writeBuffer is below the maxPayload value sent by the server (only for HTTP
       * long-polling)
       *
       * @private
       */
      _getWritablePackets() {
        const shouldCheckPayloadSize = this._maxPayload && this.transport.name === "polling" && this.writeBuffer.length > 1;
        if (!shouldCheckPayloadSize) {
          return this.writeBuffer;
        }
        let payloadSize = 1;
        for (let i = 0; i < this.writeBuffer.length; i++) {
          const data = this.writeBuffer[i].data;
          if (data) {
            payloadSize += byteLength(data);
          }
          if (i > 0 && payloadSize > this._maxPayload) {
            return this.writeBuffer.slice(0, i);
          }
          payloadSize += 2;
        }
        return this.writeBuffer;
      }
      /**
       * Checks whether the heartbeat timer has expired but the socket has not yet been notified.
       *
       * Note: this method is private for now because it does not really fit the WebSocket API, but if we put it in the
       * `write()` method then the message would not be buffered by the Socket.IO client.
       *
       * @return {boolean}
       * @private
       */
      /* private */
      _hasPingExpired() {
        if (!this._pingTimeoutTime)
          return true;
        const hasExpired = Date.now() > this._pingTimeoutTime;
        if (hasExpired) {
          this._pingTimeoutTime = 0;
          nextTick(() => {
            this._onClose("ping timeout");
          }, this.setTimeoutFn);
        }
        return hasExpired;
      }
      /**
       * Sends a message.
       *
       * @param {String} msg - message.
       * @param {Object} options.
       * @param {Function} fn - callback function.
       * @return {Socket} for chaining.
       */
      write(msg, options, fn) {
        this._sendPacket("message", msg, options, fn);
        return this;
      }
      /**
       * Sends a message. Alias of {@link Socket#write}.
       *
       * @param {String} msg - message.
       * @param {Object} options.
       * @param {Function} fn - callback function.
       * @return {Socket} for chaining.
       */
      send(msg, options, fn) {
        this._sendPacket("message", msg, options, fn);
        return this;
      }
      /**
       * Sends a packet.
       *
       * @param {String} type: packet type.
       * @param {String} data.
       * @param {Object} options.
       * @param {Function} fn - callback function.
       * @private
       */
      _sendPacket(type, data, options, fn) {
        if ("function" === typeof data) {
          fn = data;
          data = void 0;
        }
        if ("function" === typeof options) {
          fn = options;
          options = null;
        }
        if ("closing" === this.readyState || "closed" === this.readyState) {
          return;
        }
        options = options || {};
        options.compress = false !== options.compress;
        const packet = {
          type,
          data,
          options
        };
        this.emitReserved("packetCreate", packet);
        this.writeBuffer.push(packet);
        if (fn)
          this.once("flush", fn);
        this.flush();
      }
      /**
       * Closes the connection.
       */
      close() {
        const close = () => {
          this._onClose("forced close");
          this.transport.close();
        };
        const cleanupAndClose = () => {
          this.off("upgrade", cleanupAndClose);
          this.off("upgradeError", cleanupAndClose);
          close();
        };
        const waitForUpgrade = () => {
          this.once("upgrade", cleanupAndClose);
          this.once("upgradeError", cleanupAndClose);
        };
        if ("opening" === this.readyState || "open" === this.readyState) {
          this.readyState = "closing";
          if (this.writeBuffer.length) {
            this.once("drain", () => {
              if (this.upgrading) {
                waitForUpgrade();
              } else {
                close();
              }
            });
          } else if (this.upgrading) {
            waitForUpgrade();
          } else {
            close();
          }
        }
        return this;
      }
      /**
       * Called upon transport error
       *
       * @private
       */
      _onError(err) {
        _SocketWithoutUpgrade.priorWebsocketSuccess = false;
        if (this.opts.tryAllTransports && this.transports.length > 1 && this.readyState === "opening") {
          this.transports.shift();
          return this._open();
        }
        this.emitReserved("error", err);
        this._onClose("transport error", err);
      }
      /**
       * Called upon transport close.
       *
       * @private
       */
      _onClose(reason, description) {
        if ("opening" === this.readyState || "open" === this.readyState || "closing" === this.readyState) {
          this.clearTimeoutFn(this._pingTimeoutTimer);
          this.transport.removeAllListeners("close");
          this.transport.close();
          this.transport.removeAllListeners();
          if (withEventListeners) {
            if (this._beforeunloadEventListener) {
              removeEventListener("beforeunload", this._beforeunloadEventListener, false);
            }
            if (this._offlineEventListener) {
              const i = OFFLINE_EVENT_LISTENERS.indexOf(this._offlineEventListener);
              if (i !== -1) {
                OFFLINE_EVENT_LISTENERS.splice(i, 1);
              }
            }
          }
          this.readyState = "closed";
          this.id = null;
          this.emitReserved("close", reason, description);
          this.writeBuffer = [];
          this._prevBufferLen = 0;
        }
      }
    };
    SocketWithoutUpgrade.protocol = protocol;
    SocketWithUpgrade = class extends SocketWithoutUpgrade {
      constructor() {
        super(...arguments);
        this._upgrades = [];
      }
      onOpen() {
        super.onOpen();
        if ("open" === this.readyState && this.opts.upgrade) {
          for (let i = 0; i < this._upgrades.length; i++) {
            this._probe(this._upgrades[i]);
          }
        }
      }
      /**
       * Probes a transport.
       *
       * @param {String} name - transport name
       * @private
       */
      _probe(name) {
        let transport = this.createTransport(name);
        let failed = false;
        SocketWithoutUpgrade.priorWebsocketSuccess = false;
        const onTransportOpen = () => {
          if (failed)
            return;
          transport.send([{ type: "ping", data: "probe" }]);
          transport.once("packet", (msg) => {
            if (failed)
              return;
            if ("pong" === msg.type && "probe" === msg.data) {
              this.upgrading = true;
              this.emitReserved("upgrading", transport);
              if (!transport)
                return;
              SocketWithoutUpgrade.priorWebsocketSuccess = "websocket" === transport.name;
              this.transport.pause(() => {
                if (failed)
                  return;
                if ("closed" === this.readyState)
                  return;
                cleanup();
                this.setTransport(transport);
                transport.send([{ type: "upgrade" }]);
                this.emitReserved("upgrade", transport);
                transport = null;
                this.upgrading = false;
                this.flush();
              });
            } else {
              const err = new Error("probe error");
              err.transport = transport.name;
              this.emitReserved("upgradeError", err);
            }
          });
        };
        function freezeTransport() {
          if (failed)
            return;
          failed = true;
          cleanup();
          transport.close();
          transport = null;
        }
        const onerror = (err) => {
          const error = new Error("probe error: " + err);
          error.transport = transport.name;
          freezeTransport();
          this.emitReserved("upgradeError", error);
        };
        function onTransportClose() {
          onerror("transport closed");
        }
        function onclose() {
          onerror("socket closed");
        }
        function onupgrade(to) {
          if (transport && to.name !== transport.name) {
            freezeTransport();
          }
        }
        const cleanup = () => {
          transport.removeListener("open", onTransportOpen);
          transport.removeListener("error", onerror);
          transport.removeListener("close", onTransportClose);
          this.off("close", onclose);
          this.off("upgrading", onupgrade);
        };
        transport.once("open", onTransportOpen);
        transport.once("error", onerror);
        transport.once("close", onTransportClose);
        this.once("close", onclose);
        this.once("upgrading", onupgrade);
        if (this._upgrades.indexOf("webtransport") !== -1 && name !== "webtransport") {
          this.setTimeoutFn(() => {
            if (!failed) {
              transport.open();
            }
          }, 200);
        } else {
          transport.open();
        }
      }
      onHandshake(data) {
        this._upgrades = this._filterUpgrades(data.upgrades);
        super.onHandshake(data);
      }
      /**
       * Filters upgrades, returning only those matching client transports.
       *
       * @param {Array} upgrades - server upgrades
       * @private
       */
      _filterUpgrades(upgrades) {
        const filteredUpgrades = [];
        for (let i = 0; i < upgrades.length; i++) {
          if (~this.transports.indexOf(upgrades[i]))
            filteredUpgrades.push(upgrades[i]);
        }
        return filteredUpgrades;
      }
    };
    Socket = class extends SocketWithUpgrade {
      constructor(uri, opts = {}) {
        const o = typeof uri === "object" ? uri : opts;
        if (!o.transports || o.transports && typeof o.transports[0] === "string") {
          o.transports = (o.transports || ["polling", "websocket", "webtransport"]).map((transportName) => transports[transportName]).filter((t) => !!t);
        }
        super(uri, o);
      }
    };
  }
});

// node_modules/engine.io-client/build/esm/transports/polling-fetch.js
var init_polling_fetch = __esm({
  "node_modules/engine.io-client/build/esm/transports/polling-fetch.js"() {
    init_polling();
  }
});

// node_modules/engine.io-client/build/esm/index.js
var protocol2;
var init_esm3 = __esm({
  "node_modules/engine.io-client/build/esm/index.js"() {
    init_socket();
    init_socket();
    init_transport();
    init_transports();
    init_util();
    init_parseuri();
    init_globals();
    init_polling_fetch();
    init_polling_xhr();
    init_polling_xhr();
    init_websocket();
    init_websocket();
    init_webtransport();
    protocol2 = Socket.protocol;
  }
});

// node_modules/socket.io-client/build/esm/url.js
function url(uri, path = "", loc) {
  let obj = uri;
  loc = loc || typeof location !== "undefined" && location;
  if (null == uri)
    uri = loc.protocol + "//" + loc.host;
  if (typeof uri === "string") {
    if ("/" === uri.charAt(0)) {
      if ("/" === uri.charAt(1)) {
        uri = loc.protocol + uri;
      } else {
        uri = loc.host + uri;
      }
    }
    if (!/^(https?|wss?):\/\//.test(uri)) {
      if ("undefined" !== typeof loc) {
        uri = loc.protocol + "//" + uri;
      } else {
        uri = "https://" + uri;
      }
    }
    obj = parse(uri);
  }
  if (!obj.port) {
    if (/^(http|ws)$/.test(obj.protocol)) {
      obj.port = "80";
    } else if (/^(http|ws)s$/.test(obj.protocol)) {
      obj.port = "443";
    }
  }
  obj.path = obj.path || "/";
  const ipv6 = obj.host.indexOf(":") !== -1;
  const host = ipv6 ? "[" + obj.host + "]" : obj.host;
  obj.id = obj.protocol + "://" + host + ":" + obj.port + path;
  obj.href = obj.protocol + "://" + host + (loc && loc.port === obj.port ? "" : ":" + obj.port);
  return obj;
}
var init_url = __esm({
  "node_modules/socket.io-client/build/esm/url.js"() {
    init_esm3();
  }
});

// node_modules/socket.io-parser/build/esm/is-binary.js
function isBinary(obj) {
  return withNativeArrayBuffer3 && (obj instanceof ArrayBuffer || isView2(obj)) || withNativeBlob2 && obj instanceof Blob || withNativeFile && obj instanceof File;
}
function hasBinary(obj, toJSON) {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  if (Array.isArray(obj)) {
    for (let i = 0, l = obj.length; i < l; i++) {
      if (hasBinary(obj[i])) {
        return true;
      }
    }
    return false;
  }
  if (isBinary(obj)) {
    return true;
  }
  if (obj.toJSON && typeof obj.toJSON === "function" && arguments.length === 1) {
    return hasBinary(obj.toJSON(), true);
  }
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
      return true;
    }
  }
  return false;
}
var withNativeArrayBuffer3, isView2, toString, withNativeBlob2, withNativeFile;
var init_is_binary = __esm({
  "node_modules/socket.io-parser/build/esm/is-binary.js"() {
    withNativeArrayBuffer3 = typeof ArrayBuffer === "function";
    isView2 = (obj) => {
      return typeof ArrayBuffer.isView === "function" ? ArrayBuffer.isView(obj) : obj.buffer instanceof ArrayBuffer;
    };
    toString = Object.prototype.toString;
    withNativeBlob2 = typeof Blob === "function" || typeof Blob !== "undefined" && toString.call(Blob) === "[object BlobConstructor]";
    withNativeFile = typeof File === "function" || typeof File !== "undefined" && toString.call(File) === "[object FileConstructor]";
  }
});

// node_modules/socket.io-parser/build/esm/binary.js
function deconstructPacket(packet) {
  const buffers = [];
  const packetData = packet.data;
  const pack = packet;
  pack.data = _deconstructPacket(packetData, buffers);
  pack.attachments = buffers.length;
  return { packet: pack, buffers };
}
function _deconstructPacket(data, buffers) {
  if (!data)
    return data;
  if (isBinary(data)) {
    const placeholder = { _placeholder: true, num: buffers.length };
    buffers.push(data);
    return placeholder;
  } else if (Array.isArray(data)) {
    const newData = new Array(data.length);
    for (let i = 0; i < data.length; i++) {
      newData[i] = _deconstructPacket(data[i], buffers);
    }
    return newData;
  } else if (typeof data === "object" && !(data instanceof Date)) {
    const newData = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        newData[key] = _deconstructPacket(data[key], buffers);
      }
    }
    return newData;
  }
  return data;
}
function reconstructPacket(packet, buffers) {
  packet.data = _reconstructPacket(packet.data, buffers);
  delete packet.attachments;
  return packet;
}
function _reconstructPacket(data, buffers) {
  if (!data)
    return data;
  if (data && data._placeholder === true) {
    const isIndexValid = typeof data.num === "number" && data.num >= 0 && data.num < buffers.length;
    if (isIndexValid) {
      return buffers[data.num];
    } else {
      throw new Error("illegal attachments");
    }
  } else if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      data[i] = _reconstructPacket(data[i], buffers);
    }
  } else if (typeof data === "object") {
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        data[key] = _reconstructPacket(data[key], buffers);
      }
    }
  }
  return data;
}
var init_binary = __esm({
  "node_modules/socket.io-parser/build/esm/binary.js"() {
    init_is_binary();
  }
});

// node_modules/socket.io-parser/build/esm/index.js
var esm_exports = {};
__export(esm_exports, {
  Decoder: () => Decoder,
  Encoder: () => Encoder,
  PacketType: () => PacketType,
  isPacketValid: () => isPacketValid,
  protocol: () => protocol3
});
function isNamespaceValid(nsp) {
  return typeof nsp === "string";
}
function isAckIdValid(id) {
  return id === void 0 || isInteger(id);
}
function isObject(value2) {
  return Object.prototype.toString.call(value2) === "[object Object]";
}
function isDataValid(type, payload) {
  switch (type) {
    case PacketType.CONNECT:
      return payload === void 0 || isObject(payload);
    case PacketType.DISCONNECT:
      return payload === void 0;
    case PacketType.EVENT:
      return Array.isArray(payload) && (typeof payload[0] === "number" || typeof payload[0] === "string" && RESERVED_EVENTS.indexOf(payload[0]) === -1);
    case PacketType.ACK:
      return Array.isArray(payload);
    case PacketType.CONNECT_ERROR:
      return typeof payload === "string" || isObject(payload);
    default:
      return false;
  }
}
function isPacketValid(packet) {
  return isNamespaceValid(packet.nsp) && isAckIdValid(packet.id) && isDataValid(packet.type, packet.data);
}
var RESERVED_EVENTS, protocol3, PacketType, Encoder, Decoder, BinaryReconstructor, isInteger;
var init_esm4 = __esm({
  "node_modules/socket.io-parser/build/esm/index.js"() {
    init_esm2();
    init_binary();
    init_is_binary();
    RESERVED_EVENTS = [
      "connect",
      // used on the client side
      "connect_error",
      // used on the client side
      "disconnect",
      // used on both sides
      "disconnecting",
      // used on the server side
      "newListener",
      // used by the Node.js EventEmitter
      "removeListener"
      // used by the Node.js EventEmitter
    ];
    protocol3 = 5;
    (function(PacketType2) {
      PacketType2[PacketType2["CONNECT"] = 0] = "CONNECT";
      PacketType2[PacketType2["DISCONNECT"] = 1] = "DISCONNECT";
      PacketType2[PacketType2["EVENT"] = 2] = "EVENT";
      PacketType2[PacketType2["ACK"] = 3] = "ACK";
      PacketType2[PacketType2["CONNECT_ERROR"] = 4] = "CONNECT_ERROR";
      PacketType2[PacketType2["BINARY_EVENT"] = 5] = "BINARY_EVENT";
      PacketType2[PacketType2["BINARY_ACK"] = 6] = "BINARY_ACK";
    })(PacketType || (PacketType = {}));
    Encoder = class {
      /**
       * Encoder constructor
       *
       * @param {function} replacer - custom replacer to pass down to JSON.parse
       */
      constructor(replacer) {
        this.replacer = replacer;
      }
      /**
       * Encode a packet as a single string if non-binary, or as a
       * buffer sequence, depending on packet type.
       *
       * @param {Object} obj - packet object
       */
      encode(obj) {
        if (obj.type === PacketType.EVENT || obj.type === PacketType.ACK) {
          if (hasBinary(obj)) {
            return this.encodeAsBinary({
              type: obj.type === PacketType.EVENT ? PacketType.BINARY_EVENT : PacketType.BINARY_ACK,
              nsp: obj.nsp,
              data: obj.data,
              id: obj.id
            });
          }
        }
        return [this.encodeAsString(obj)];
      }
      /**
       * Encode packet as string.
       */
      encodeAsString(obj) {
        let str = "" + obj.type;
        if (obj.type === PacketType.BINARY_EVENT || obj.type === PacketType.BINARY_ACK) {
          str += obj.attachments + "-";
        }
        if (obj.nsp && "/" !== obj.nsp) {
          str += obj.nsp + ",";
        }
        if (null != obj.id) {
          str += obj.id;
        }
        if (null != obj.data) {
          str += JSON.stringify(obj.data, this.replacer);
        }
        return str;
      }
      /**
       * Encode packet as 'buffer sequence' by removing blobs, and
       * deconstructing packet into object with placeholders and
       * a list of buffers.
       */
      encodeAsBinary(obj) {
        const deconstruction = deconstructPacket(obj);
        const pack = this.encodeAsString(deconstruction.packet);
        const buffers = deconstruction.buffers;
        buffers.unshift(pack);
        return buffers;
      }
    };
    Decoder = class _Decoder extends Emitter {
      /**
       * Decoder constructor
       *
       * @param {function} reviver - custom reviver to pass down to JSON.stringify
       */
      constructor(reviver) {
        super();
        this.reviver = reviver;
      }
      /**
       * Decodes an encoded packet string into packet JSON.
       *
       * @param {String} obj - encoded packet
       */
      add(obj) {
        let packet;
        if (typeof obj === "string") {
          if (this.reconstructor) {
            throw new Error("got plaintext data when reconstructing a packet");
          }
          packet = this.decodeString(obj);
          const isBinaryEvent = packet.type === PacketType.BINARY_EVENT;
          if (isBinaryEvent || packet.type === PacketType.BINARY_ACK) {
            packet.type = isBinaryEvent ? PacketType.EVENT : PacketType.ACK;
            this.reconstructor = new BinaryReconstructor(packet);
            if (packet.attachments === 0) {
              super.emitReserved("decoded", packet);
            }
          } else {
            super.emitReserved("decoded", packet);
          }
        } else if (isBinary(obj) || obj.base64) {
          if (!this.reconstructor) {
            throw new Error("got binary data when not reconstructing a packet");
          } else {
            packet = this.reconstructor.takeBinaryData(obj);
            if (packet) {
              this.reconstructor = null;
              super.emitReserved("decoded", packet);
            }
          }
        } else {
          throw new Error("Unknown type: " + obj);
        }
      }
      /**
       * Decode a packet String (JSON data)
       *
       * @param {String} str
       * @return {Object} packet
       */
      decodeString(str) {
        let i = 0;
        const p = {
          type: Number(str.charAt(0))
        };
        if (PacketType[p.type] === void 0) {
          throw new Error("unknown packet type " + p.type);
        }
        if (p.type === PacketType.BINARY_EVENT || p.type === PacketType.BINARY_ACK) {
          const start = i + 1;
          while (str.charAt(++i) !== "-" && i != str.length) {
          }
          const buf = str.substring(start, i);
          if (buf != Number(buf) || str.charAt(i) !== "-") {
            throw new Error("Illegal attachments");
          }
          p.attachments = Number(buf);
        }
        if ("/" === str.charAt(i + 1)) {
          const start = i + 1;
          while (++i) {
            const c = str.charAt(i);
            if ("," === c)
              break;
            if (i === str.length)
              break;
          }
          p.nsp = str.substring(start, i);
        } else {
          p.nsp = "/";
        }
        const next = str.charAt(i + 1);
        if ("" !== next && Number(next) == next) {
          const start = i + 1;
          while (++i) {
            const c = str.charAt(i);
            if (null == c || Number(c) != c) {
              --i;
              break;
            }
            if (i === str.length)
              break;
          }
          p.id = Number(str.substring(start, i + 1));
        }
        if (str.charAt(++i)) {
          const payload = this.tryParse(str.substr(i));
          if (_Decoder.isPayloadValid(p.type, payload)) {
            p.data = payload;
          } else {
            throw new Error("invalid payload");
          }
        }
        return p;
      }
      tryParse(str) {
        try {
          return JSON.parse(str, this.reviver);
        } catch (e) {
          return false;
        }
      }
      static isPayloadValid(type, payload) {
        switch (type) {
          case PacketType.CONNECT:
            return isObject(payload);
          case PacketType.DISCONNECT:
            return payload === void 0;
          case PacketType.CONNECT_ERROR:
            return typeof payload === "string" || isObject(payload);
          case PacketType.EVENT:
          case PacketType.BINARY_EVENT:
            return Array.isArray(payload) && (typeof payload[0] === "number" || typeof payload[0] === "string" && RESERVED_EVENTS.indexOf(payload[0]) === -1);
          case PacketType.ACK:
          case PacketType.BINARY_ACK:
            return Array.isArray(payload);
        }
      }
      /**
       * Deallocates a parser's resources
       */
      destroy() {
        if (this.reconstructor) {
          this.reconstructor.finishedReconstruction();
          this.reconstructor = null;
        }
      }
    };
    BinaryReconstructor = class {
      constructor(packet) {
        this.packet = packet;
        this.buffers = [];
        this.reconPack = packet;
      }
      /**
       * Method to be called when binary data received from connection
       * after a BINARY_EVENT packet.
       *
       * @param {Buffer | ArrayBuffer} binData - the raw binary data received
       * @return {null | Object} returns null if more binary data is expected or
       *   a reconstructed packet object if all buffers have been received.
       */
      takeBinaryData(binData) {
        this.buffers.push(binData);
        if (this.buffers.length === this.reconPack.attachments) {
          const packet = reconstructPacket(this.reconPack, this.buffers);
          this.finishedReconstruction();
          return packet;
        }
        return null;
      }
      /**
       * Cleans up binary packet reconstruction variables.
       */
      finishedReconstruction() {
        this.reconPack = null;
        this.buffers = [];
      }
    };
    isInteger = Number.isInteger || function(value2) {
      return typeof value2 === "number" && isFinite(value2) && Math.floor(value2) === value2;
    };
  }
});

// node_modules/socket.io-client/build/esm/on.js
function on(obj, ev, fn) {
  obj.on(ev, fn);
  return function subDestroy() {
    obj.off(ev, fn);
  };
}
var init_on = __esm({
  "node_modules/socket.io-client/build/esm/on.js"() {
  }
});

// node_modules/socket.io-client/build/esm/socket.js
var RESERVED_EVENTS2, Socket2;
var init_socket2 = __esm({
  "node_modules/socket.io-client/build/esm/socket.js"() {
    init_esm4();
    init_on();
    init_esm2();
    RESERVED_EVENTS2 = Object.freeze({
      connect: 1,
      connect_error: 1,
      disconnect: 1,
      disconnecting: 1,
      // EventEmitter reserved events: https://nodejs.org/api/events.html#events_event_newlistener
      newListener: 1,
      removeListener: 1
    });
    Socket2 = class extends Emitter {
      /**
       * `Socket` constructor.
       */
      constructor(io, nsp, opts) {
        super();
        this.connected = false;
        this.recovered = false;
        this.receiveBuffer = [];
        this.sendBuffer = [];
        this._queue = [];
        this._queueSeq = 0;
        this.ids = 0;
        this.acks = {};
        this.flags = {};
        this.io = io;
        this.nsp = nsp;
        if (opts && opts.auth) {
          this.auth = opts.auth;
        }
        this._opts = Object.assign({}, opts);
        if (this.io._autoConnect)
          this.open();
      }
      /**
       * Whether the socket is currently disconnected
       *
       * @example
       * const socket = io();
       *
       * socket.on("connect", () => {
       *   console.log(socket.disconnected); // false
       * });
       *
       * socket.on("disconnect", () => {
       *   console.log(socket.disconnected); // true
       * });
       */
      get disconnected() {
        return !this.connected;
      }
      /**
       * Subscribe to open, close and packet events
       *
       * @private
       */
      subEvents() {
        if (this.subs)
          return;
        const io = this.io;
        this.subs = [
          on(io, "open", this.onopen.bind(this)),
          on(io, "packet", this.onpacket.bind(this)),
          on(io, "error", this.onerror.bind(this)),
          on(io, "close", this.onclose.bind(this))
        ];
      }
      /**
       * Whether the Socket will try to reconnect when its Manager connects or reconnects.
       *
       * @example
       * const socket = io();
       *
       * console.log(socket.active); // true
       *
       * socket.on("disconnect", (reason) => {
       *   if (reason === "io server disconnect") {
       *     // the disconnection was initiated by the server, you need to manually reconnect
       *     console.log(socket.active); // false
       *   }
       *   // else the socket will automatically try to reconnect
       *   console.log(socket.active); // true
       * });
       */
      get active() {
        return !!this.subs;
      }
      /**
       * "Opens" the socket.
       *
       * @example
       * const socket = io({
       *   autoConnect: false
       * });
       *
       * socket.connect();
       */
      connect() {
        if (this.connected)
          return this;
        this.subEvents();
        if (!this.io["_reconnecting"])
          this.io.open();
        if ("open" === this.io._readyState)
          this.onopen();
        return this;
      }
      /**
       * Alias for {@link connect()}.
       */
      open() {
        return this.connect();
      }
      /**
       * Sends a `message` event.
       *
       * This method mimics the WebSocket.send() method.
       *
       * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send
       *
       * @example
       * socket.send("hello");
       *
       * // this is equivalent to
       * socket.emit("message", "hello");
       *
       * @return self
       */
      send(...args) {
        args.unshift("message");
        this.emit.apply(this, args);
        return this;
      }
      /**
       * Override `emit`.
       * If the event is in `events`, it's emitted normally.
       *
       * @example
       * socket.emit("hello", "world");
       *
       * // all serializable datastructures are supported (no need to call JSON.stringify)
       * socket.emit("hello", 1, "2", { 3: ["4"], 5: Uint8Array.from([6]) });
       *
       * // with an acknowledgement from the server
       * socket.emit("hello", "world", (val) => {
       *   // ...
       * });
       *
       * @return self
       */
      emit(ev, ...args) {
        var _a, _b, _c;
        if (RESERVED_EVENTS2.hasOwnProperty(ev)) {
          throw new Error('"' + ev.toString() + '" is a reserved event name');
        }
        args.unshift(ev);
        if (this._opts.retries && !this.flags.fromQueue && !this.flags.volatile) {
          this._addToQueue(args);
          return this;
        }
        const packet = {
          type: PacketType.EVENT,
          data: args
        };
        packet.options = {};
        packet.options.compress = this.flags.compress !== false;
        if ("function" === typeof args[args.length - 1]) {
          const id = this.ids++;
          const ack = args.pop();
          this._registerAckCallback(id, ack);
          packet.id = id;
        }
        const isTransportWritable = (_b = (_a = this.io.engine) === null || _a === void 0 ? void 0 : _a.transport) === null || _b === void 0 ? void 0 : _b.writable;
        const isConnected = this.connected && !((_c = this.io.engine) === null || _c === void 0 ? void 0 : _c._hasPingExpired());
        const discardPacket = this.flags.volatile && !isTransportWritable;
        if (discardPacket) {
        } else if (isConnected) {
          this.notifyOutgoingListeners(packet);
          this.packet(packet);
        } else {
          this.sendBuffer.push(packet);
        }
        this.flags = {};
        return this;
      }
      /**
       * @private
       */
      _registerAckCallback(id, ack) {
        var _a;
        const timeout = (_a = this.flags.timeout) !== null && _a !== void 0 ? _a : this._opts.ackTimeout;
        if (timeout === void 0) {
          this.acks[id] = ack;
          return;
        }
        const timer = this.io.setTimeoutFn(() => {
          delete this.acks[id];
          for (let i = 0; i < this.sendBuffer.length; i++) {
            if (this.sendBuffer[i].id === id) {
              this.sendBuffer.splice(i, 1);
            }
          }
          ack.call(this, new Error("operation has timed out"));
        }, timeout);
        const fn = (...args) => {
          this.io.clearTimeoutFn(timer);
          ack.apply(this, args);
        };
        fn.withError = true;
        this.acks[id] = fn;
      }
      /**
       * Emits an event and waits for an acknowledgement
       *
       * @example
       * // without timeout
       * const response = await socket.emitWithAck("hello", "world");
       *
       * // with a specific timeout
       * try {
       *   const response = await socket.timeout(1000).emitWithAck("hello", "world");
       * } catch (err) {
       *   // the server did not acknowledge the event in the given delay
       * }
       *
       * @return a Promise that will be fulfilled when the server acknowledges the event
       */
      emitWithAck(ev, ...args) {
        return new Promise((resolve, reject) => {
          const fn = (arg1, arg2) => {
            return arg1 ? reject(arg1) : resolve(arg2);
          };
          fn.withError = true;
          args.push(fn);
          this.emit(ev, ...args);
        });
      }
      /**
       * Add the packet to the queue.
       * @param args
       * @private
       */
      _addToQueue(args) {
        let ack;
        if (typeof args[args.length - 1] === "function") {
          ack = args.pop();
        }
        const packet = {
          id: this._queueSeq++,
          tryCount: 0,
          pending: false,
          args,
          flags: Object.assign({ fromQueue: true }, this.flags)
        };
        args.push((err, ...responseArgs) => {
          if (packet !== this._queue[0]) {
          }
          const hasError = err !== null;
          if (hasError) {
            if (packet.tryCount > this._opts.retries) {
              this._queue.shift();
              if (ack) {
                ack(err);
              }
            }
          } else {
            this._queue.shift();
            if (ack) {
              ack(null, ...responseArgs);
            }
          }
          packet.pending = false;
          return this._drainQueue();
        });
        this._queue.push(packet);
        this._drainQueue();
      }
      /**
       * Send the first packet of the queue, and wait for an acknowledgement from the server.
       * @param force - whether to resend a packet that has not been acknowledged yet
       *
       * @private
       */
      _drainQueue(force = false) {
        if (!this.connected || this._queue.length === 0) {
          return;
        }
        const packet = this._queue[0];
        if (packet.pending && !force) {
          return;
        }
        packet.pending = true;
        packet.tryCount++;
        this.flags = packet.flags;
        this.emit.apply(this, packet.args);
      }
      /**
       * Sends a packet.
       *
       * @param packet
       * @private
       */
      packet(packet) {
        packet.nsp = this.nsp;
        this.io._packet(packet);
      }
      /**
       * Called upon engine `open`.
       *
       * @private
       */
      onopen() {
        if (typeof this.auth == "function") {
          this.auth((data) => {
            this._sendConnectPacket(data);
          });
        } else {
          this._sendConnectPacket(this.auth);
        }
      }
      /**
       * Sends a CONNECT packet to initiate the Socket.IO session.
       *
       * @param data
       * @private
       */
      _sendConnectPacket(data) {
        this.packet({
          type: PacketType.CONNECT,
          data: this._pid ? Object.assign({ pid: this._pid, offset: this._lastOffset }, data) : data
        });
      }
      /**
       * Called upon engine or manager `error`.
       *
       * @param err
       * @private
       */
      onerror(err) {
        if (!this.connected) {
          this.emitReserved("connect_error", err);
        }
      }
      /**
       * Called upon engine `close`.
       *
       * @param reason
       * @param description
       * @private
       */
      onclose(reason, description) {
        this.connected = false;
        delete this.id;
        this.emitReserved("disconnect", reason, description);
        this._clearAcks();
      }
      /**
       * Clears the acknowledgement handlers upon disconnection, since the client will never receive an acknowledgement from
       * the server.
       *
       * @private
       */
      _clearAcks() {
        Object.keys(this.acks).forEach((id) => {
          const isBuffered = this.sendBuffer.some((packet) => String(packet.id) === id);
          if (!isBuffered) {
            const ack = this.acks[id];
            delete this.acks[id];
            if (ack.withError) {
              ack.call(this, new Error("socket has been disconnected"));
            }
          }
        });
      }
      /**
       * Called with socket packet.
       *
       * @param packet
       * @private
       */
      onpacket(packet) {
        const sameNamespace = packet.nsp === this.nsp;
        if (!sameNamespace)
          return;
        switch (packet.type) {
          case PacketType.CONNECT:
            if (packet.data && packet.data.sid) {
              this.onconnect(packet.data.sid, packet.data.pid);
            } else {
              this.emitReserved("connect_error", new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));
            }
            break;
          case PacketType.EVENT:
          case PacketType.BINARY_EVENT:
            this.onevent(packet);
            break;
          case PacketType.ACK:
          case PacketType.BINARY_ACK:
            this.onack(packet);
            break;
          case PacketType.DISCONNECT:
            this.ondisconnect();
            break;
          case PacketType.CONNECT_ERROR:
            this.destroy();
            const err = new Error(packet.data.message);
            err.data = packet.data.data;
            this.emitReserved("connect_error", err);
            break;
        }
      }
      /**
       * Called upon a server event.
       *
       * @param packet
       * @private
       */
      onevent(packet) {
        const args = packet.data || [];
        if (null != packet.id) {
          args.push(this.ack(packet.id));
        }
        if (this.connected) {
          this.emitEvent(args);
        } else {
          this.receiveBuffer.push(Object.freeze(args));
        }
      }
      emitEvent(args) {
        if (this._anyListeners && this._anyListeners.length) {
          const listeners = this._anyListeners.slice();
          for (const listener of listeners) {
            listener.apply(this, args);
          }
        }
        super.emit.apply(this, args);
        if (this._pid && args.length && typeof args[args.length - 1] === "string") {
          this._lastOffset = args[args.length - 1];
        }
      }
      /**
       * Produces an ack callback to emit with an event.
       *
       * @private
       */
      ack(id) {
        const self2 = this;
        let sent = false;
        return function(...args) {
          if (sent)
            return;
          sent = true;
          self2.packet({
            type: PacketType.ACK,
            id,
            data: args
          });
        };
      }
      /**
       * Called upon a server acknowledgement.
       *
       * @param packet
       * @private
       */
      onack(packet) {
        const ack = this.acks[packet.id];
        if (typeof ack !== "function") {
          return;
        }
        delete this.acks[packet.id];
        if (ack.withError) {
          packet.data.unshift(null);
        }
        ack.apply(this, packet.data);
      }
      /**
       * Called upon server connect.
       *
       * @private
       */
      onconnect(id, pid) {
        this.id = id;
        this.recovered = pid && this._pid === pid;
        this._pid = pid;
        this.connected = true;
        this.emitBuffered();
        this._drainQueue(true);
        this.emitReserved("connect");
      }
      /**
       * Emit buffered events (received and emitted).
       *
       * @private
       */
      emitBuffered() {
        this.receiveBuffer.forEach((args) => this.emitEvent(args));
        this.receiveBuffer = [];
        this.sendBuffer.forEach((packet) => {
          this.notifyOutgoingListeners(packet);
          this.packet(packet);
        });
        this.sendBuffer = [];
      }
      /**
       * Called upon server disconnect.
       *
       * @private
       */
      ondisconnect() {
        this.destroy();
        this.onclose("io server disconnect");
      }
      /**
       * Called upon forced client/server side disconnections,
       * this method ensures the manager stops tracking us and
       * that reconnections don't get triggered for this.
       *
       * @private
       */
      destroy() {
        if (this.subs) {
          this.subs.forEach((subDestroy) => subDestroy());
          this.subs = void 0;
        }
        this.io["_destroy"](this);
      }
      /**
       * Disconnects the socket manually. In that case, the socket will not try to reconnect.
       *
       * If this is the last active Socket instance of the {@link Manager}, the low-level connection will be closed.
       *
       * @example
       * const socket = io();
       *
       * socket.on("disconnect", (reason) => {
       *   // console.log(reason); prints "io client disconnect"
       * });
       *
       * socket.disconnect();
       *
       * @return self
       */
      disconnect() {
        if (this.connected) {
          this.packet({ type: PacketType.DISCONNECT });
        }
        this.destroy();
        if (this.connected) {
          this.onclose("io client disconnect");
        }
        return this;
      }
      /**
       * Alias for {@link disconnect()}.
       *
       * @return self
       */
      close() {
        return this.disconnect();
      }
      /**
       * Sets the compress flag.
       *
       * @example
       * socket.compress(false).emit("hello");
       *
       * @param compress - if `true`, compresses the sending data
       * @return self
       */
      compress(compress) {
        this.flags.compress = compress;
        return this;
      }
      /**
       * Sets a modifier for a subsequent event emission that the event message will be dropped when this socket is not
       * ready to send messages.
       *
       * @example
       * socket.volatile.emit("hello"); // the server may or may not receive it
       *
       * @returns self
       */
      get volatile() {
        this.flags.volatile = true;
        return this;
      }
      /**
       * Sets a modifier for a subsequent event emission that the callback will be called with an error when the
       * given number of milliseconds have elapsed without an acknowledgement from the server:
       *
       * @example
       * socket.timeout(5000).emit("my-event", (err) => {
       *   if (err) {
       *     // the server did not acknowledge the event in the given delay
       *   }
       * });
       *
       * @returns self
       */
      timeout(timeout) {
        this.flags.timeout = timeout;
        return this;
      }
      /**
       * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
       * callback.
       *
       * @example
       * socket.onAny((event, ...args) => {
       *   console.log(`got ${event}`);
       * });
       *
       * @param listener
       */
      onAny(listener) {
        this._anyListeners = this._anyListeners || [];
        this._anyListeners.push(listener);
        return this;
      }
      /**
       * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
       * callback. The listener is added to the beginning of the listeners array.
       *
       * @example
       * socket.prependAny((event, ...args) => {
       *   console.log(`got event ${event}`);
       * });
       *
       * @param listener
       */
      prependAny(listener) {
        this._anyListeners = this._anyListeners || [];
        this._anyListeners.unshift(listener);
        return this;
      }
      /**
       * Removes the listener that will be fired when any event is emitted.
       *
       * @example
       * const catchAllListener = (event, ...args) => {
       *   console.log(`got event ${event}`);
       * }
       *
       * socket.onAny(catchAllListener);
       *
       * // remove a specific listener
       * socket.offAny(catchAllListener);
       *
       * // or remove all listeners
       * socket.offAny();
       *
       * @param listener
       */
      offAny(listener) {
        if (!this._anyListeners) {
          return this;
        }
        if (listener) {
          const listeners = this._anyListeners;
          for (let i = 0; i < listeners.length; i++) {
            if (listener === listeners[i]) {
              listeners.splice(i, 1);
              return this;
            }
          }
        } else {
          this._anyListeners = [];
        }
        return this;
      }
      /**
       * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
       * e.g. to remove listeners.
       */
      listenersAny() {
        return this._anyListeners || [];
      }
      /**
       * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
       * callback.
       *
       * Note: acknowledgements sent to the server are not included.
       *
       * @example
       * socket.onAnyOutgoing((event, ...args) => {
       *   console.log(`sent event ${event}`);
       * });
       *
       * @param listener
       */
      onAnyOutgoing(listener) {
        this._anyOutgoingListeners = this._anyOutgoingListeners || [];
        this._anyOutgoingListeners.push(listener);
        return this;
      }
      /**
       * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
       * callback. The listener is added to the beginning of the listeners array.
       *
       * Note: acknowledgements sent to the server are not included.
       *
       * @example
       * socket.prependAnyOutgoing((event, ...args) => {
       *   console.log(`sent event ${event}`);
       * });
       *
       * @param listener
       */
      prependAnyOutgoing(listener) {
        this._anyOutgoingListeners = this._anyOutgoingListeners || [];
        this._anyOutgoingListeners.unshift(listener);
        return this;
      }
      /**
       * Removes the listener that will be fired when any event is emitted.
       *
       * @example
       * const catchAllListener = (event, ...args) => {
       *   console.log(`sent event ${event}`);
       * }
       *
       * socket.onAnyOutgoing(catchAllListener);
       *
       * // remove a specific listener
       * socket.offAnyOutgoing(catchAllListener);
       *
       * // or remove all listeners
       * socket.offAnyOutgoing();
       *
       * @param [listener] - the catch-all listener (optional)
       */
      offAnyOutgoing(listener) {
        if (!this._anyOutgoingListeners) {
          return this;
        }
        if (listener) {
          const listeners = this._anyOutgoingListeners;
          for (let i = 0; i < listeners.length; i++) {
            if (listener === listeners[i]) {
              listeners.splice(i, 1);
              return this;
            }
          }
        } else {
          this._anyOutgoingListeners = [];
        }
        return this;
      }
      /**
       * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
       * e.g. to remove listeners.
       */
      listenersAnyOutgoing() {
        return this._anyOutgoingListeners || [];
      }
      /**
       * Notify the listeners for each packet sent
       *
       * @param packet
       *
       * @private
       */
      notifyOutgoingListeners(packet) {
        if (this._anyOutgoingListeners && this._anyOutgoingListeners.length) {
          const listeners = this._anyOutgoingListeners.slice();
          for (const listener of listeners) {
            listener.apply(this, packet.data);
          }
        }
      }
    };
  }
});

// node_modules/socket.io-client/build/esm/contrib/backo2.js
function Backoff(opts) {
  opts = opts || {};
  this.ms = opts.min || 100;
  this.max = opts.max || 1e4;
  this.factor = opts.factor || 2;
  this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
  this.attempts = 0;
}
var init_backo2 = __esm({
  "node_modules/socket.io-client/build/esm/contrib/backo2.js"() {
    Backoff.prototype.duration = function() {
      var ms = this.ms * Math.pow(this.factor, this.attempts++);
      if (this.jitter) {
        var rand2 = Math.random();
        var deviation = Math.floor(rand2 * this.jitter * ms);
        ms = (Math.floor(rand2 * 10) & 1) == 0 ? ms - deviation : ms + deviation;
      }
      return Math.min(ms, this.max) | 0;
    };
    Backoff.prototype.reset = function() {
      this.attempts = 0;
    };
    Backoff.prototype.setMin = function(min) {
      this.ms = min;
    };
    Backoff.prototype.setMax = function(max) {
      this.max = max;
    };
    Backoff.prototype.setJitter = function(jitter) {
      this.jitter = jitter;
    };
  }
});

// node_modules/socket.io-client/build/esm/manager.js
var Manager;
var init_manager = __esm({
  "node_modules/socket.io-client/build/esm/manager.js"() {
    init_esm3();
    init_socket2();
    init_esm4();
    init_on();
    init_backo2();
    init_esm2();
    Manager = class extends Emitter {
      constructor(uri, opts) {
        var _a;
        super();
        this.nsps = {};
        this.subs = [];
        if (uri && "object" === typeof uri) {
          opts = uri;
          uri = void 0;
        }
        opts = opts || {};
        opts.path = opts.path || "/socket.io";
        this.opts = opts;
        installTimerFunctions(this, opts);
        this.reconnection(opts.reconnection !== false);
        this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
        this.reconnectionDelay(opts.reconnectionDelay || 1e3);
        this.reconnectionDelayMax(opts.reconnectionDelayMax || 5e3);
        this.randomizationFactor((_a = opts.randomizationFactor) !== null && _a !== void 0 ? _a : 0.5);
        this.backoff = new Backoff({
          min: this.reconnectionDelay(),
          max: this.reconnectionDelayMax(),
          jitter: this.randomizationFactor()
        });
        this.timeout(null == opts.timeout ? 2e4 : opts.timeout);
        this._readyState = "closed";
        this.uri = uri;
        const _parser = opts.parser || esm_exports;
        this.encoder = new _parser.Encoder();
        this.decoder = new _parser.Decoder();
        this._autoConnect = opts.autoConnect !== false;
        if (this._autoConnect)
          this.open();
      }
      reconnection(v) {
        if (!arguments.length)
          return this._reconnection;
        this._reconnection = !!v;
        if (!v) {
          this.skipReconnect = true;
        }
        return this;
      }
      reconnectionAttempts(v) {
        if (v === void 0)
          return this._reconnectionAttempts;
        this._reconnectionAttempts = v;
        return this;
      }
      reconnectionDelay(v) {
        var _a;
        if (v === void 0)
          return this._reconnectionDelay;
        this._reconnectionDelay = v;
        (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMin(v);
        return this;
      }
      randomizationFactor(v) {
        var _a;
        if (v === void 0)
          return this._randomizationFactor;
        this._randomizationFactor = v;
        (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setJitter(v);
        return this;
      }
      reconnectionDelayMax(v) {
        var _a;
        if (v === void 0)
          return this._reconnectionDelayMax;
        this._reconnectionDelayMax = v;
        (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMax(v);
        return this;
      }
      timeout(v) {
        if (!arguments.length)
          return this._timeout;
        this._timeout = v;
        return this;
      }
      /**
       * Starts trying to reconnect if reconnection is enabled and we have not
       * started reconnecting yet
       *
       * @private
       */
      maybeReconnectOnOpen() {
        if (!this._reconnecting && this._reconnection && this.backoff.attempts === 0) {
          this.reconnect();
        }
      }
      /**
       * Sets the current transport `socket`.
       *
       * @param {Function} fn - optional, callback
       * @return self
       * @public
       */
      open(fn) {
        if (~this._readyState.indexOf("open"))
          return this;
        this.engine = new Socket(this.uri, this.opts);
        const socket = this.engine;
        const self2 = this;
        this._readyState = "opening";
        this.skipReconnect = false;
        const openSubDestroy = on(socket, "open", function() {
          self2.onopen();
          fn && fn();
        });
        const onError = (err) => {
          this.cleanup();
          this._readyState = "closed";
          this.emitReserved("error", err);
          if (fn) {
            fn(err);
          } else {
            this.maybeReconnectOnOpen();
          }
        };
        const errorSub = on(socket, "error", onError);
        if (false !== this._timeout) {
          const timeout = this._timeout;
          const timer = this.setTimeoutFn(() => {
            openSubDestroy();
            onError(new Error("timeout"));
            socket.close();
          }, timeout);
          if (this.opts.autoUnref) {
            timer.unref();
          }
          this.subs.push(() => {
            this.clearTimeoutFn(timer);
          });
        }
        this.subs.push(openSubDestroy);
        this.subs.push(errorSub);
        return this;
      }
      /**
       * Alias for open()
       *
       * @return self
       * @public
       */
      connect(fn) {
        return this.open(fn);
      }
      /**
       * Called upon transport open.
       *
       * @private
       */
      onopen() {
        this.cleanup();
        this._readyState = "open";
        this.emitReserved("open");
        const socket = this.engine;
        this.subs.push(
          on(socket, "ping", this.onping.bind(this)),
          on(socket, "data", this.ondata.bind(this)),
          on(socket, "error", this.onerror.bind(this)),
          on(socket, "close", this.onclose.bind(this)),
          // @ts-ignore
          on(this.decoder, "decoded", this.ondecoded.bind(this))
        );
      }
      /**
       * Called upon a ping.
       *
       * @private
       */
      onping() {
        this.emitReserved("ping");
      }
      /**
       * Called with data.
       *
       * @private
       */
      ondata(data) {
        try {
          this.decoder.add(data);
        } catch (e) {
          this.onclose("parse error", e);
        }
      }
      /**
       * Called when parser fully decodes a packet.
       *
       * @private
       */
      ondecoded(packet) {
        nextTick(() => {
          this.emitReserved("packet", packet);
        }, this.setTimeoutFn);
      }
      /**
       * Called upon socket error.
       *
       * @private
       */
      onerror(err) {
        this.emitReserved("error", err);
      }
      /**
       * Creates a new socket for the given `nsp`.
       *
       * @return {Socket}
       * @public
       */
      socket(nsp, opts) {
        let socket = this.nsps[nsp];
        if (!socket) {
          socket = new Socket2(this, nsp, opts);
          this.nsps[nsp] = socket;
        } else if (this._autoConnect && !socket.active) {
          socket.connect();
        }
        return socket;
      }
      /**
       * Called upon a socket close.
       *
       * @param socket
       * @private
       */
      _destroy(socket) {
        const nsps = Object.keys(this.nsps);
        for (const nsp of nsps) {
          const socket2 = this.nsps[nsp];
          if (socket2.active) {
            return;
          }
        }
        this._close();
      }
      /**
       * Writes a packet.
       *
       * @param packet
       * @private
       */
      _packet(packet) {
        const encodedPackets = this.encoder.encode(packet);
        for (let i = 0; i < encodedPackets.length; i++) {
          this.engine.write(encodedPackets[i], packet.options);
        }
      }
      /**
       * Clean up transport subscriptions and packet buffer.
       *
       * @private
       */
      cleanup() {
        this.subs.forEach((subDestroy) => subDestroy());
        this.subs.length = 0;
        this.decoder.destroy();
      }
      /**
       * Close the current socket.
       *
       * @private
       */
      _close() {
        this.skipReconnect = true;
        this._reconnecting = false;
        this.onclose("forced close");
      }
      /**
       * Alias for close()
       *
       * @private
       */
      disconnect() {
        return this._close();
      }
      /**
       * Called when:
       *
       * - the low-level engine is closed
       * - the parser encountered a badly formatted packet
       * - all sockets are disconnected
       *
       * @private
       */
      onclose(reason, description) {
        var _a;
        this.cleanup();
        (_a = this.engine) === null || _a === void 0 ? void 0 : _a.close();
        this.backoff.reset();
        this._readyState = "closed";
        this.emitReserved("close", reason, description);
        if (this._reconnection && !this.skipReconnect) {
          this.reconnect();
        }
      }
      /**
       * Attempt a reconnection.
       *
       * @private
       */
      reconnect() {
        if (this._reconnecting || this.skipReconnect)
          return this;
        const self2 = this;
        if (this.backoff.attempts >= this._reconnectionAttempts) {
          this.backoff.reset();
          this.emitReserved("reconnect_failed");
          this._reconnecting = false;
        } else {
          const delay = this.backoff.duration();
          this._reconnecting = true;
          const timer = this.setTimeoutFn(() => {
            if (self2.skipReconnect)
              return;
            this.emitReserved("reconnect_attempt", self2.backoff.attempts);
            if (self2.skipReconnect)
              return;
            self2.open((err) => {
              if (err) {
                self2._reconnecting = false;
                self2.reconnect();
                this.emitReserved("reconnect_error", err);
              } else {
                self2.onreconnect();
              }
            });
          }, delay);
          if (this.opts.autoUnref) {
            timer.unref();
          }
          this.subs.push(() => {
            this.clearTimeoutFn(timer);
          });
        }
      }
      /**
       * Called upon successful reconnect.
       *
       * @private
       */
      onreconnect() {
        const attempt = this.backoff.attempts;
        this._reconnecting = false;
        this.backoff.reset();
        this.emitReserved("reconnect", attempt);
      }
    };
  }
});

// node_modules/socket.io-client/build/esm/index.js
function lookup2(uri, opts) {
  if (typeof uri === "object") {
    opts = uri;
    uri = void 0;
  }
  opts = opts || {};
  const parsed = url(uri, opts.path || "/socket.io");
  const source = parsed.source;
  const id = parsed.id;
  const path = parsed.path;
  const sameNamespace = cache[id] && path in cache[id]["nsps"];
  const newConnection = opts.forceNew || opts["force new connection"] || false === opts.multiplex || sameNamespace;
  let io;
  if (newConnection) {
    io = new Manager(source, opts);
  } else {
    if (!cache[id]) {
      cache[id] = new Manager(source, opts);
    }
    io = cache[id];
  }
  if (parsed.query && !opts.query) {
    opts.query = parsed.queryKey;
  }
  return io.socket(parsed.path, opts);
}
var cache;
var init_esm5 = __esm({
  "node_modules/socket.io-client/build/esm/index.js"() {
    init_url();
    init_manager();
    init_socket2();
    init_esm4();
    init_esm3();
    cache = {};
    Object.assign(lookup2, {
      Manager,
      Socket: Socket2,
      io: lookup2,
      connect: lookup2
    });
  }
});

// engine.ts
function buildSquareList(orientation = "w") {
  const files = orientation === "w" ? [...FILES] : [...FILES].reverse();
  const ranks = orientation === "w" ? [...RANKS].reverse() : [...RANKS];
  const squares = [];
  for (const rank2 of ranks) {
    for (const file2 of files) {
      squares.push(`${file2}${rank2}`);
    }
  }
  return squares;
}
function isLightSquare(square) {
  const fileIndex = FILES.indexOf(square[0]);
  const rankIndex = RANKS.indexOf(square[1]);
  return (fileIndex + rankIndex) % 2 === 1;
}
var FILES, RANKS;
var init_engine = __esm({
  "engine.ts"() {
    "use strict";
    FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
    RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"];
  }
});

// src/client/theme-palette.css
var init_theme_palette = __esm({
  "src/client/theme-palette.css"() {
  }
});

// src/client/button-animations.css
var init_button_animations = __esm({
  "src/client/button-animations.css"() {
  }
});

// src/client/arrows.css
var init_arrows = __esm({
  "src/client/arrows.css"() {
  }
});

// src/client/styles.css
var init_styles = __esm({
  "src/client/styles.css"() {
  }
});

// src/client/arrow-geometry.ts
function buildArrowPath(start, end, options = {}) {
  const shaftWidth = options.shaftWidth ?? 14;
  const headLength = options.headLength ?? 56;
  const headWidth = options.headWidth ?? 46;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) {
    return "";
  }
  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;
  const safeHeadLength = Math.min(headLength, Math.max(18, length * 0.45));
  const shaftHalf = shaftWidth / 2;
  const headHalf = headWidth / 2;
  const baseX = end.x - ux * safeHeadLength;
  const baseY = end.y - uy * safeHeadLength;
  const tailLeftX = start.x + px * shaftHalf;
  const tailLeftY = start.y + py * shaftHalf;
  const tailRightX = start.x - px * shaftHalf;
  const tailRightY = start.y - py * shaftHalf;
  const baseLeftX = baseX + px * shaftHalf;
  const baseLeftY = baseY + py * shaftHalf;
  const baseRightX = baseX - px * shaftHalf;
  const baseRightY = baseY - py * shaftHalf;
  const wingLeftX = baseX + px * headHalf;
  const wingLeftY = baseY + py * headHalf;
  const wingRightX = baseX - px * headHalf;
  const wingRightY = baseY - py * headHalf;
  return [
    `M ${tailLeftX.toFixed(2)} ${tailLeftY.toFixed(2)}`,
    `L ${baseLeftX.toFixed(2)} ${baseLeftY.toFixed(2)}`,
    `L ${wingLeftX.toFixed(2)} ${wingLeftY.toFixed(2)}`,
    `L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    `L ${wingRightX.toFixed(2)} ${wingRightY.toFixed(2)}`,
    `L ${baseRightX.toFixed(2)} ${baseRightY.toFixed(2)}`,
    `L ${tailRightX.toFixed(2)} ${tailRightY.toFixed(2)}`,
    `A ${shaftHalf.toFixed(2)} ${shaftHalf.toFixed(2)} 0 0 0 ${tailLeftX.toFixed(2)} ${tailLeftY.toFixed(2)}`,
    "Z"
  ].join(" ");
}
var init_arrow_geometry = __esm({
  "src/client/arrow-geometry.ts"() {
    "use strict";
  }
});

// src/client/arrow-render.ts
function buildArrowLayerMarkup(params) {
  const { variant, annotations, preview, bestMove, squareCenter } = params;
  const baseClass = `${variant}-arrow`;
  const annotationMarkup = [...annotations].map((entry) => {
    const [from, to] = entry.split("-");
    const pathData = buildArrowPath(squareCenter(from), squareCenter(to));
    if (!pathData) {
      return "";
    }
    return `<path class="${baseClass}" d="${pathData}"/>`;
  }).join("");
  const previewMarkup = preview ? (() => {
    const pathData = buildArrowPath(squareCenter(preview.from), preview.pointer);
    if (!pathData) {
      return "";
    }
    return `<path class="${baseClass} ${baseClass}-preview" d="${pathData}"/>`;
  })() : "";
  const bestMoveMarkup = bestMove ? (() => {
    const pathData = buildArrowPath(squareCenter(bestMove.from), squareCenter(bestMove.to));
    if (!pathData) {
      return "";
    }
    return `<path class="${baseClass} ${baseClass}-best-move" d="${pathData}"/>`;
  })() : "";
  return `${annotationMarkup}${bestMoveMarkup}${previewMarkup}`;
}
var init_arrow_render = __esm({
  "src/client/arrow-render.ts"() {
    "use strict";
    init_arrow_geometry();
  }
});

// src/client/best-move-arrow.ts
function parseBestMoveArrow(uci) {
  const normalized = (uci ?? "").trim().toLowerCase();
  if (!UCI_MOVE_PATTERN.test(normalized)) {
    return null;
  }
  return {
    from: normalized.slice(0, 2),
    to: normalized.slice(2, 4)
  };
}
function canShowBestMoveArrow(isAnalysisEnabled, isGameOver) {
  return isAnalysisEnabled || isGameOver;
}
var UCI_MOVE_PATTERN;
var init_best_move_arrow = __esm({
  "src/client/best-move-arrow.ts"() {
    "use strict";
    UCI_MOVE_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
  }
});

// src/client/theme.ts
function setTheme(theme) {
  if (theme === "forest") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  document.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === theme);
  });
}
function setAnimationStyle(style) {
  localStorage.setItem(ANIMATION_STORAGE_KEY, style);
  document.querySelectorAll(".animation-btn").forEach((btn) => {
    const isActive = btn.dataset.animation === style;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-checked", String(isActive));
  });
  const event = new CustomEvent("animationchange", { detail: { style } });
  window.dispatchEvent(event);
}
function setBloodFxEnabled(enabled) {
  localStorage.setItem(BLOOD_FX_STORAGE_KEY, enabled ? "on" : "off");
  document.querySelectorAll(".fx-btn:not(.legal-btn)").forEach((btn) => {
    const isActive = btn.dataset.bloodfx === "on" === enabled;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-checked", String(isActive));
  });
  const event = new CustomEvent("bloodfxchange", { detail: { enabled } });
  window.dispatchEvent(event);
}
function setLegalMovesEnabled(enabled) {
  localStorage.setItem(LEGAL_MOVES_STORAGE_KEY, enabled ? "on" : "off");
  document.querySelectorAll(".legal-btn").forEach((btn) => {
    const isActive = btn.dataset.legal === "on" === enabled;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-checked", String(isActive));
  });
  const event = new CustomEvent("legalmoveschange", { detail: { enabled } });
  window.dispatchEvent(event);
}
function setPanelCollapsed(widget, toggleBtn, collapsed) {
  widget.classList.toggle("is-collapsed", collapsed);
  toggleBtn.setAttribute("aria-expanded", String(!collapsed));
  toggleBtn.style.transform = collapsed ? "rotate(0deg)" : "rotate(180deg)";
  localStorage.setItem(THEME_PANEL_COLLAPSED_KEY, collapsed ? "1" : "0");
}
function mountThemeSwitcher() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "forest";
  const savedAnimationStyle = localStorage.getItem(ANIMATION_STORAGE_KEY) || "smooth";
  const bloodFxRaw = localStorage.getItem(BLOOD_FX_STORAGE_KEY);
  const bloodFxEnabled = bloodFxRaw === "on";
  const legalMovesRaw = localStorage.getItem(LEGAL_MOVES_STORAGE_KEY);
  const legalMovesEnabled = legalMovesRaw !== "off";
  const collapsedRaw = localStorage.getItem(THEME_PANEL_COLLAPSED_KEY);
  const defaultCollapsed = window.matchMedia("(max-width: 640px)").matches;
  const initialCollapsed = collapsedRaw === null ? defaultCollapsed : collapsedRaw === "1";
  setTheme(savedTheme);
  const widget = document.createElement("div");
  widget.className = "theme-switcher";
  widget.setAttribute("role", "group");
  widget.setAttribute("aria-label", "Theme and animation options");
  widget.innerHTML = `
    <button class="theme-toggle-btn" type="button" aria-label="Toggle theme selector" aria-expanded="true">\u25B6</button>
    <div class="theme-switcher-content">
      <div class="theme-switcher-row">
        <span class="theme-switcher-label">Theme</span>
        <div class="theme-switcher-options">
          <button class="theme-btn" data-theme="forest" title="Classic Forest" aria-label="Classic Forest theme"></button>
          <button class="theme-btn" data-theme="purple" title="Cosmic Purple" aria-label="Cosmic Purple theme"></button>
          <button class="theme-btn" data-theme="walnut" title="Walnut & Cream" aria-label="Walnut & Cream theme"></button>
          <button class="theme-btn" data-theme="refined" title="Refined" aria-label="Refined theme"></button>
        </div>
      </div>
      <div class="theme-switcher-row">
        <span class="theme-switcher-label">Animations</span>
        <div class="animation-segment" role="radiogroup" aria-label="Animation style">
          <button class="animation-btn" type="button" data-animation="smooth" role="radio" aria-label="Smooth animations">Smooth</button>
          <button class="animation-btn" type="button" data-animation="epic" role="radio" aria-label="Epic animations">Epic</button>
        </div>
      </div>
      <div class="theme-switcher-row">
        <span class="theme-switcher-label">Blood FX</span>
        <div class="fx-segment" role="radiogroup" aria-label="Blood effect toggle">
          <button class="fx-btn" type="button" data-bloodfx="off" role="radio" aria-label="Disable blood effect">Off</button>
          <button class="fx-btn" type="button" data-bloodfx="on" role="radio" aria-label="Enable blood effect">On</button>
        </div>
      </div>
      <div class="theme-switcher-row">
        <span class="theme-switcher-label">Watch Legal Moves</span>
        <div class="fx-segment" role="radiogroup" aria-label="Legal moves toggle">
          <button class="legal-btn fx-btn" type="button" data-legal="off" role="radio" aria-label="Hide legal moves">Off</button>
          <button class="legal-btn fx-btn" type="button" data-legal="on" role="radio" aria-label="Show legal moves">On</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(widget);
  const toggleButton = widget.querySelector(".theme-toggle-btn");
  if (!toggleButton) return;
  setPanelCollapsed(widget, toggleButton, initialCollapsed);
  widget.addEventListener("click", (e) => {
    const toggle = e.target.closest(".theme-toggle-btn");
    if (toggle) {
      const collapsed = !widget.classList.contains("is-collapsed");
      setPanelCollapsed(widget, toggleButton, collapsed);
      return;
    }
    const btn = e.target.closest(".theme-btn");
    if (btn?.dataset.theme) setTheme(btn.dataset.theme);
    const animBtn = e.target.closest(".animation-btn");
    if (animBtn?.dataset.animation) setAnimationStyle(animBtn.dataset.animation);
    const targetEl = e.target;
    if (targetEl.closest(".legal-btn")) {
      const legalBtn = targetEl.closest(".legal-btn");
      if (legalBtn?.dataset.legal) setLegalMovesEnabled(legalBtn.dataset.legal === "on");
    } else if (targetEl.closest(".fx-btn")) {
      const fxBtn = targetEl.closest(".fx-btn");
      if (fxBtn?.dataset.bloodfx) setBloodFxEnabled(fxBtn.dataset.bloodfx === "on");
    }
  });
  document.querySelectorAll(".animation-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.animation === savedAnimationStyle);
    btn.setAttribute("aria-checked", String(btn.dataset.animation === savedAnimationStyle));
  });
  document.querySelectorAll(".fx-btn:not(.legal-btn)").forEach((btn) => {
    const isActive = btn.dataset.bloodfx === "on" === bloodFxEnabled;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-checked", String(isActive));
  });
  document.querySelectorAll(".legal-btn").forEach((btn) => {
    const isActive = btn.dataset.legal === "on" === legalMovesEnabled;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-checked", String(isActive));
  });
}
var THEME_STORAGE_KEY, THEME_PANEL_COLLAPSED_KEY, ANIMATION_STORAGE_KEY, BLOOD_FX_STORAGE_KEY, LEGAL_MOVES_STORAGE_KEY;
var init_theme = __esm({
  "src/client/theme.ts"() {
    "use strict";
    THEME_STORAGE_KEY = "chess-theme";
    THEME_PANEL_COLLAPSED_KEY = "chess-theme-panel-collapsed";
    ANIMATION_STORAGE_KEY = "chess-animation-style";
    BLOOD_FX_STORAGE_KEY = "chess-blood-fx";
    LEGAL_MOVES_STORAGE_KEY = "chess-legal-moves";
  }
});

// src/client/main.ts
var require_main = __commonJS({
  "src/client/main.ts"() {
    init_chess();
    init_esm5();
    init_engine();
    init_theme_palette();
    init_button_animations();
    init_arrows();
    init_styles();
    init_arrow_render();
    init_best_move_arrow();
    init_theme();
    var PIECES = {
      wp: "/pieces/wP.svg",
      wn: "/pieces/wN.svg",
      wb: "/pieces/wB.svg",
      wr: "/pieces/wR.svg",
      wq: "/pieces/wQ.svg",
      wk: "/pieces/wK.svg",
      bp: "/pieces/bP.svg",
      bn: "/pieces/bN.svg",
      bb: "/pieces/bB.svg",
      br: "/pieces/bR.svg",
      bq: "/pieces/bQ.svg",
      bk: "/pieces/bK.svg"
    };
    var chess = new Chess();
    var socket = lookup2();
    var app = document.querySelector("#app");
    if (!app) {
      throw new Error("Missing #app root element.");
    }
    var initialRoomCode = new URLSearchParams(window.location.search).get("room")?.trim() ?? null;
    var savedRoomId = localStorage.getItem("chess_roomId");
    var autoJoinCode = initialRoomCode ?? (savedRoomId || null);
    var state = {
      connected: false,
      roomId: null,
      role: null,
      shareUrl: "",
      snapshot: null,
      orientation: "w",
      selectedSquare: null,
      legalTargets: [],
      toastMessage: "",
      pendingPromotion: null,
      premoves: [],
      autoJoinCode,
      focusMode: false,
      liveAnalysisSummary: "Live analysis disabled.",
      lastAnalyzedMoveKey: null,
      liveMoveGrades: {},
      animationStyle: localStorage.getItem("chess-animation-style") || "smooth",
      bloodFxEnabled: localStorage.getItem("chess-blood-fx") === "on",
      gameMode: "multiplayer",
      viewCursor: null,
      trailFxEnabled: localStorage.getItem("chess-trail-fx") === "on",
      legalMovesEnabled: localStorage.getItem("chess-legal-moves") !== "off",
      bestMoveArrow: null,
      bestMoveArrowFen: null
    };
    window.state = state;
    var lastAnimatedMoveKey = null;
    var suppressAnimationForMove = null;
    var activeGhostAnimation = null;
    var activeGhostNode = null;
    var activeGhostDestinationPiece = null;
    var pendingBoardRefresh = false;
    var liveAnalyzer = null;
    var liveAnalysisToken = 0;
    var bestMoveArrowToken = 0;
    var currentModalAction = null;
    var animationFinished = true;
    var animatingToSquare = null;
    var lastRoomStateReceivedAtMs = Date.now();
    var SMOOTH_MOVE_DURATION_MS = 620;
    var EPIC_MOVE_DURATION_MS = {
      smash: 860,
      spin: 760,
      slide: 620
    };
    var LIVE_MATE_CP = 1e5;
    var PIECE_VALUES = {
      p: 100,
      n: 320,
      b: 330,
      r: 500,
      q: 900,
      k: 0
    };
    var LIVE_CATEGORY_LABELS = {
      brilliant: "Brilliant",
      great: "Great",
      excellent: "Excellent",
      good: "Good",
      inaccuracy: "Inaccuracy",
      mistake: "Mistake",
      blunder: "Blunder"
    };
    var ROOM_CODE_LENGTH = 4;
    var ROOM_ID_PATTERN = new RegExp(`^\\d{${ROOM_CODE_LENGTH}}$`);
    function applyAnimationTiming(style) {
      const cssDuration = style === "epic" ? 760 : SMOOTH_MOVE_DURATION_MS;
      document.documentElement.style.setProperty("--move-duration", `${cssDuration}ms`);
    }
    var StockfishBridge = class {
      worker;
      ready = false;
      initResolve;
      initReject;
      initPromise;
      activeEval = null;
      queue = Promise.resolve();
      constructor(workerPath = "/stockfish/stockfish-18-lite-single.js") {
        this.worker = new Worker(workerPath);
        this.initPromise = new Promise((resolve, reject) => {
          this.initResolve = resolve;
          this.initReject = reject;
        });
        this.worker.onmessage = (event) => this.onMessage(String(event.data ?? ""));
        this.worker.onerror = () => {
          if (!this.ready) this.initReject(new Error("Stockfish init failed."));
          this.activeEval?.reject(new Error("Worker error."));
          this.activeEval = null;
        };
        this.send("uci");
        this.send("setoption name UCI_LimitStrength value true");
        this.send("setoption name UCI_Elo value 800");
        this.send("isready");
      }
      /** Gets the best move from the engine for the Bot player */
      async getBotMove(fen, timeLimitMs = 1e3) {
        await this.initPromise;
        const botPromise = this.queue.then(() => {
          return new Promise((resolve, reject) => {
            this.activeEval = {
              resolve: (res) => resolve(res.bestMove),
              reject,
              lastCp: 0,
              mate: null,
              pv: "",
              bestMove: ""
            };
            this.send(`position fen ${fen}`);
            this.send(`go movetime ${timeLimitMs}`);
          });
        });
        this.queue = botPromise.then(() => void 0).catch(() => void 0);
        return botPromise;
      }
      /** Standard analysis evaluation */
      async evaluateFen(fen, depth) {
        await this.initPromise;
        const evalPromise = this.queue.then(() => {
          return new Promise((resolve, reject) => {
            this.activeEval = { resolve, reject, lastCp: 0, mate: null, pv: "", bestMove: "" };
            this.send(`position fen ${fen}`);
            this.send(`go depth ${depth}`);
          });
        });
        this.queue = evalPromise.then(() => void 0).catch(() => void 0);
        return evalPromise;
      }
      onMessage(line) {
        if (line === "readyok" && !this.ready) {
          this.ready = true;
          this.initResolve();
          return;
        }
        if (!this.activeEval) return;
        if (line.startsWith("info ")) {
          const parsed = parseInfoLine(line);
          if (parsed) {
            this.activeEval.lastCp = parsed.cp;
            this.activeEval.mate = parsed.mate;
            this.activeEval.pv = parsed.pv;
          }
        } else if (line.startsWith("bestmove ")) {
          this.activeEval.bestMove = line.split(" ")[1] ?? "";
          this.activeEval.resolve({
            cp: this.activeEval.lastCp,
            mate: this.activeEval.mate,
            bestMove: this.activeEval.bestMove,
            pv: this.activeEval.pv
          });
          this.activeEval = null;
        }
      }
      send(cmd) {
        this.worker.postMessage(cmd);
      }
      terminate() {
        this.worker.terminate();
      }
    };
    function parseInfoLine(line) {
      const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
      if (!scoreMatch) {
        return null;
      }
      const kind = scoreMatch[1];
      const value2 = Number(scoreMatch[2]);
      const pvMatch = line.match(/\spv\s(.+)$/);
      const pv = pvMatch?.[1]?.trim() ?? "";
      if (kind === "mate") {
        const cp = value2 > 0 ? LIVE_MATE_CP - Math.min(Math.abs(value2), 99) * 100 : -LIVE_MATE_CP + Math.min(Math.abs(value2), 99) * 100;
        return { cp, mate: value2, pv };
      }
      return { cp: value2, mate: null, pv };
    }
    var _audioCache = {};
    function playSound(name) {
      let audio = _audioCache[name];
      if (!audio) {
        audio = new Audio(`/sounds/${name}.mp3`);
        _audioCache[name] = audio;
      }
      audio.currentTime = 0;
      audio.play().catch(() => {
      });
    }
    var _lastPlayedMoveCount = -1;
    function playSoundForSnapshot(snapshot) {
      const last = snapshot.lastMove;
      if (!last) return;
      if (snapshot.checkmate || snapshot.draw) {
        playSound("gameEndOrCheckmate");
      } else if (snapshot.check) {
        playSound("checkMove");
      } else if (last.san.startsWith("O-O")) {
        playSound("castle");
      } else if (last.san.includes("x")) {
        playSound("capture");
      } else {
        playSound("move-self");
      }
    }
    app.innerHTML = `
  <div class="app-shell">
    <nav class="game-nav" id="gameNav" hidden>
      <button class="nav-back-link" id="backToMenuButton" type="button">\u2190 Back to menu</button>
    </nav>

    <header class="hero">
      <section class="hero-card hero-copy">
        <h1>Multiplayer Chess</h1>
        <p>Create a room or join one with code.</p>
        <a class="analysis-board-link cta-rainbow" href="/analyze">\u265F Open Analysis Board</a>
      </section>
      <aside class="hero-card status-card">
        <div class="status-grid">
          <div>
            <strong>Room</strong>
            <div class="muted" id="roomBadge">No active room</div>
          </div>
          <div>
            <strong>Your seat</strong>
            <div class="muted" id="roleBadge">Not seated</div>
          </div>  
          <div>
            <strong>Match state</strong>
            <div class="muted" id="matchStatus">Create a room to start.</div>
          </div>
        </div>
      </aside>
    </header>

    <main class="layout">
      <section class="panel board-panel">
        <div class="board-toolbar">
          <button class="action cta-turquoise" id="createRoomButton" type="button">Create room</button>
          <button class="action cta-rainbow" id="playBotButton" type="button">Play vs Bot (800 ELO)</button>
          <button class="ghost" id="rematchButton" type="button" hidden>Request rematch</button>
          <button class="ghost" id="undoRequestButton" type="button" hidden>Request undo</button>
          <button class="ghost" id="undoDeclineButton" type="button" hidden>Decline undo</button>
          <button class="ghost" id="labelsOnlyButton" type="button" hidden>Labels only: Off</button>
          <button class="ghost" id="flipBoardButton" type="button" hidden>Flip board</button>
          <button class="ghost" id="liveAnalysisButton" type="button" hidden>Live analysis</button>
          <button class="ghost" id="resignButton" type="button" hidden>Resign</button>
        </div>
       <div class="pregame-placeholder" id="pregamePlaceholder">
          <div id="pregameWaiting">
            <h2>Waiting for opponent</h2>
            <p>Create or join a room. The board appears automatically once both players are connected.</p>
          </div>
          <div id="pregameSelection" hidden>
            <h2>Choose Your Color</h2>
            <div class="mode-row">
              <strong>Game mode</strong>
              <div class="mode-options" id="modeOptions">
                <button class="mode-opt-btn" id="modeBlitz3" type="button">3-minute Blitz</button>
                <button class="mode-opt-btn" id="modeRapid10" type="button">10-minute Rapid</button>
                <button class="mode-opt-btn" id="modeBlitz3p2" type="button">3+2 Blitz</button>
              </div>
              <p class="muted" id="modeHint">Room creator selects the timer. Color choice and ready are still required.</p>
            </div>
            <div class="selection-grid">
              <div class="selection-col">
                <strong>You</strong>
                <div class="color-options">
                  <button class="color-opt-btn" id="myPickWhite">White</button>
                  <button class="color-opt-btn" id="myPickBlack">Black</button>
                </div>
                <div class="ready-badge" id="myReadyBadge">Ready!</div>
              </div>
              <div class="selection-col">
                <strong>Opponent</strong>
                <div class="color-options">
                  <button class="color-opt-btn disabled" id="opPickWhite">White</button>
                  <button class="color-opt-btn disabled" id="opPickBlack">Black</button>
                </div>
                <div class="ready-badge" id="opReadyBadge">Ready!</div>
              </div>
            </div>
            <div style="margin-top: 24px;">
              <button class="action" id="pregameReadyBtn">Ready to Play</button>
              <div id="pregameConflictWarning" hidden>Both players cannot select the same color.</div>
            </div>
          </div>
        </div>

        <div class="board-wrap">
          <div class="board" id="board"></div>
          <svg class="board-arrows" id="arrowLayer" viewBox="0 0 800 800" aria-hidden="true"></svg>
        </div>
        <div class="board-caption" id="boardCaption">
          Tap or click one of your pieces, then choose a legal destination.
        </div>

        <div class="nav-row" id="gameNavRow" hidden>
          <button id="liveNavFirst" title="Go to start">\u23EE</button>
          <button id="liveNavPrev"  title="Previous move">\u25C0</button>
          <button id="liveNavNext"  title="Next move">\u25B6</button>
          <button id="liveNavLast"  title="Go to live">\u23ED</button>
        </div>

        <div class="focus-hud" id="focusHud" hidden>
            <span class="focus-chip" id="focusTimer">00:00</span>

          <div id="focusMaterialHud" class="focus-material-hud" hidden>
            <span class="focus-chip" id="focusMaterialScore"></span>
            <span class="focus-chip" id="focusMaterialIcons"></span>
          </div>
        </div>

      

        <button class="focus-toggle-btn" id="focusModeBtn" type="button" aria-pressed="false">Focus</button>
      </section>

      <aside class="panel side-panel">
        <section class="control-card" id="inviteJoinCard">
          <h2 class="card-title">Invite or join <span class="title-decor">!!</span></h2>
          <div class="control-row">
            <button class="chip" id="copyLinkButton" type="button" hidden>Copy invite link</button>
            <button class="chip" id="leaveRoomButton" type="button" hidden>Leave room</button>
          </div>
          <div class="join-grid">
            <input class="join-input" id="roomInput" maxlength="4" inputmode="numeric" pattern="\\d{4}" placeholder="4-digit code" />
            <button class="action" id="joinRoomButton" type="button">Join</button>
          </div>
          <div class="link-row">
            <span class="muted">Share URL</span>
            <span class="room-link" id="shareLink">Create or join a room to get a live invite link.</span>
          </div>
        </section>

        <section class="seat-card" id="seatCard" hidden>
          <h2 class="card-title">Seats</h2>
          <div class="seat-grid">
            <article class="seat">
              <strong>White</strong>
              <span class="muted" id="whiteSeat">Waiting for player</span>
              <span class="clock-pill" id="whiteClock">03:00</span>
            </article>
            <article class="seat">
              <strong>Black</strong>
              <span class="muted" id="blackSeat">Waiting for player</span>
              <span class="clock-pill" id="blackClock">03:00</span>
            </article>
          </div>
          <div class="meta-grid" style="margin-top: 14px;">
            <div>
              <span class="meta-label">Turn</span>
              <span class="muted" id="turnMeta">White</span>
            </div>
            <div>
              <span class="meta-label">Moves</span>
              <span class="muted" id="movesMeta">0</span>
            </div>
            <div>
              <span class="meta-label">Viewers</span>
              <span class="muted" id="spectatorMeta">0</span>
            </div>
          </div>
        </section>

        <section class="summary-card" id="summaryCard" hidden>
          <h2 class="card-title">Game summary</h2>
          <p class="muted" id="summaryText">The server will keep this board authoritative for every device in the room.</p>
          <p class="muted" id="liveAnalysisText">Live analysis disabled.</p>
        </section>

        <section class="moves-card" id="movesCard" hidden>
          <h2 class="card-title">Moves</h2>
          <div class="move-list" id="moveList">
            <div class="empty-state">No moves yet.</div>
          </div>
        </section>
      </aside>
    </main>
  </div>

  <div class="promotion-dialog" id="promotionDialog" hidden>
    <div class="promotion-card">
      <h2 class="card-title">Choose a promotion</h2>
      <p class="muted">Select the piece that your pawn should become.</p>
      <div class="promotion-grid">
        <button class="promotion-button" data-promotion="q" type="button">Queen</button>
        <button class="promotion-button" data-promotion="r" type="button">Rook</button>
        <button class="promotion-button" data-promotion="b" type="button">Bishop</button>
        <button class="promotion-button" data-promotion="n" type="button">Knight</button>
      </div>
    </div>
  </div>

 <div class="modal-overlay" id="confirmDialog" hidden>
  <div class="modal-card">
    <div class="modal-header">
      <h2 class="modal-title" id="modalTitle">Leave Match?</h2>
      <p class="modal-text" id="modalDescription">Your current game progress will be lost.</p>
    </div>
    <div class="modal-actions">
      <button class="modal-btn cancel" id="confirmNoBtn" type="button">Stay</button>
      <button class="modal-btn confirm" id="confirmYesBtn" type="button">Confirm</button>
    </div>
  </div>
</div>
  <div class="toast" id="toast"></div>
`;
    var board = must("#board");
    var pregamePlaceholder = must("#pregamePlaceholder");
    var inviteJoinCard = must("#inviteJoinCard");
    var roomInput = must("#roomInput");
    var roomBadge = must("#roomBadge");
    var roleBadge = must("#roleBadge");
    var matchStatus = must("#matchStatus");
    var boardCaption = must("#boardCaption");
    var shareLink = must("#shareLink");
    var seatCard = must("#seatCard");
    var summaryCard = must("#summaryCard");
    var movesCard = must("#movesCard");
    var whiteSeat = must("#whiteSeat");
    var blackSeat = must("#blackSeat");
    var turnMeta = must("#turnMeta");
    var movesMeta = must("#movesMeta");
    var spectatorMeta = must("#spectatorMeta");
    var summaryText = must("#summaryText");
    var liveAnalysisText = must("#liveAnalysisText");
    var moveList = must("#moveList");
    var toast = must("#toast");
    var promotionDialog = must("#promotionDialog");
    var createRoomButton = must("#createRoomButton");
    var backToMenuButton = must("#backToMenuButton");
    var focusHud = must("#focusHud");
    var focusTimer = must("#focusTimer");
    var focusModeButton = must("#focusModeBtn");
    var focusMaterialHud = must("#focusMaterialHud");
    var focusMaterialScore = must("#focusMaterialScore");
    var focusMaterialIcons = must("#focusMaterialIcons");
    var playBotButton = must("#playBotButton");
    var confirmDialog = must("#confirmDialog");
    var confirmYesBtn = must("#confirmYesBtn");
    var confirmNoBtn = must("#confirmNoBtn");
    var modalTitle = must("#modalTitle");
    var modalDescription = must("#modalDescription");
    var gameNav = must("#gameNav");
    var pregameWaiting = must("#pregameWaiting");
    var pregameSelection = must("#pregameSelection");
    var modeBlitz3 = must("#modeBlitz3");
    var modeRapid10 = must("#modeRapid10");
    var modeBlitz3p2 = must("#modeBlitz3p2");
    var modeHint = must("#modeHint");
    var myPickWhite = must("#myPickWhite");
    var myPickBlack = must("#myPickBlack");
    var opPickWhite = must("#opPickWhite");
    var opPickBlack = must("#opPickBlack");
    var myReadyBadge = must("#myReadyBadge");
    var opReadyBadge = must("#opReadyBadge");
    var pregameReadyBtn = must("#pregameReadyBtn");
    var pregameConflictWarning = must("#pregameConflictWarning");
    var whiteClock = must("#whiteClock");
    var blackClock = must("#blackClock");
    modeBlitz3.addEventListener("click", () => socket.emit("pregame:mode", { mode: "blitz3" }));
    modeRapid10.addEventListener("click", () => socket.emit("pregame:mode", { mode: "rapid10" }));
    modeBlitz3p2.addEventListener("click", () => socket.emit("pregame:mode", { mode: "blitz3p2" }));
    myPickWhite.addEventListener("click", () => socket.emit("pregame:select", { color: "w" }));
    myPickBlack.addEventListener("click", () => socket.emit("pregame:select", { color: "b" }));
    pregameReadyBtn.addEventListener("click", () => socket.emit("pregame:ready"));
    mountThemeSwitcher();
    applyAnimationTiming(state.animationStyle);
    window.addEventListener("animationchange", (event) => {
      const customEvent = event;
      state.animationStyle = customEvent.detail.style;
      applyAnimationTiming(state.animationStyle);
    });
    window.addEventListener("bloodfxchange", (event) => {
      const customEvent = event;
      state.bloodFxEnabled = customEvent.detail.enabled;
    });
    window.addEventListener("legalmoveschange", (event) => {
      const customEvent = event;
      state.legalMovesEnabled = customEvent.detail.enabled;
      requestBoardRefresh(true);
    });
    var joinRoomButton = must("#joinRoomButton");
    var joinGrid = must(".join-grid");
    var copyLinkButton = must("#copyLinkButton");
    var leaveRoomButton = must("#leaveRoomButton");
    var flipBoardButton = must("#flipBoardButton");
    var rematchButton = must("#rematchButton");
    var undoRequestButton = must("#undoRequestButton");
    var undoDeclineButton = must("#undoDeclineButton");
    var labelsOnlyButton = must("#labelsOnlyButton");
    var liveAnalysisButton = must("#liveAnalysisButton");
    var arrowLayer = must("#arrowLayer");
    var resignButton = must("#resignButton");
    var liveNavFirst = must("#liveNavFirst");
    var liveNavPrev = must("#liveNavPrev");
    var liveNavNext = must("#liveNavNext");
    var liveNavLast = must("#liveNavLast");
    var gameNavRow = must("#gameNavRow");
    var arrowAnnotations = /* @__PURE__ */ new Set();
    var squareAnnotations = /* @__PURE__ */ new Set();
    playBotButton.addEventListener("click", () => {
      if (state.roomId && state.gameMode === "multiplayer") {
        toggleConfirmModal(true, "bot");
      } else {
        startBotGame();
      }
    });
    createRoomButton.addEventListener("click", () => {
      state.gameMode = "multiplayer";
      socket.emit("room:create");
      scrollToInviteJoinCardOnMobile();
    });
    joinRoomButton.addEventListener("click", () => {
      const code = roomInput.value.trim();
      if (!code) {
        showToast("Enter a room code first.");
        return;
      }
      if (!ROOM_ID_PATTERN.test(code)) {
        showToast("Room code must be exactly 4 digits.");
        return;
      }
      socket.emit("room:join", { roomId: code });
    });
    copyLinkButton.addEventListener("click", async () => {
      if (!state.shareUrl) {
        showToast("Create or join a room before copying a link.");
        return;
      }
      try {
        await navigator.clipboard.writeText(state.shareUrl);
        showToast("Invite link copied.");
      } catch {
        showToast("Clipboard access failed. Copy the link manually.");
      }
    });
    liveNavFirst.addEventListener("click", () => {
      if (!state.snapshot || state.snapshot.moves.length === 0) return;
      state.viewCursor = 0;
      render();
    });
    liveNavPrev.addEventListener("click", () => {
      if (!state.snapshot || state.snapshot.moves.length === 0) return;
      const currentPos = state.viewCursor !== null ? state.viewCursor : state.snapshot.moves.length;
      if (currentPos > 0) {
        state.viewCursor = currentPos - 1;
        render();
      }
    });
    liveNavNext.addEventListener("click", () => {
      if (!state.snapshot || state.snapshot.moves.length === 0) return;
      const maxMoves = state.snapshot.moves.length;
      const currentPos = state.viewCursor !== null ? state.viewCursor : maxMoves;
      if (currentPos < maxMoves) {
        state.viewCursor = currentPos + 1;
        if (state.viewCursor === maxMoves) state.viewCursor = null;
        render();
      }
    });
    liveNavLast.addEventListener("click", () => {
      if (!state.snapshot || state.snapshot.moves.length === 0) return;
      state.viewCursor = null;
      render();
    });
    leaveRoomButton.addEventListener("click", () => {
      if (!state.roomId) {
        showToast("You are not in a room.");
        return;
      }
      socket.emit("room:leave");
      clearLocalRoomState();
      render();
    });
    resignButton.addEventListener("click", () => {
      const gameEnded = Boolean(state.snapshot && (state.snapshot.checkmate || state.snapshot.draw || state.snapshot.winner !== null));
      if (gameEnded) return;
      toggleConfirmModal(true, "resign");
    });
    rematchButton.addEventListener("click", () => {
      if (state.gameMode === "multiplayer") {
        socket.emit("game:rematch");
      } else {
        startBotGame();
      }
    });
    undoRequestButton.addEventListener("click", () => {
      const snapshot = state.snapshot;
      if (!snapshot || state.gameMode !== "multiplayer") {
        return;
      }
      const canRespondToPendingUndo = snapshot.undo.pending && snapshot.undo.requester !== null && snapshot.undo.requester !== state.role;
      if (canRespondToPendingUndo) {
        socket.emit("game:undo:respond", { accept: true });
        return;
      }
      socket.emit("game:undo:request");
    });
    undoDeclineButton.addEventListener("click", () => {
      const snapshot = state.snapshot;
      if (!snapshot || !snapshot.undo.pending) {
        return;
      }
      socket.emit("game:undo:respond", { accept: false });
    });
    labelsOnlyButton.addEventListener("click", () => {
      if (state.gameMode === "bot" && state.snapshot) {
        state.snapshot.analysis.enabled = !state.snapshot.analysis.enabled;
        if (state.snapshot.analysis.enabled) {
          void maybeRunLiveAnalysis(state.snapshot);
        } else {
          state.lastAnalyzedMoveKey = null;
          state.liveMoveGrades = {};
          clearBestMoveArrow();
        }
        render();
        return;
      }
      if (state.gameMode !== "multiplayer") {
        return;
      }
      socket.emit("analysis:labels:toggle");
    });
    flipBoardButton.addEventListener("click", () => {
      state.orientation = state.orientation === "w" ? "b" : "w";
      requestBoardRefresh();
      updateCaption();
    });
    liveAnalysisButton.addEventListener("click", () => {
      if (state.gameMode === "bot" && state.snapshot) {
        state.snapshot.analysis.enabled = !state.snapshot.analysis.enabled;
        if (state.snapshot.analysis.enabled) {
          void maybeRunLiveAnalysis(state.snapshot);
        }
        void maybeUpdateBestMoveArrow(state.snapshot);
        render();
      } else {
        socket.emit("analysis:toggle");
      }
    });
    var toggleConfirmModal = (show, type) => {
      if (show && type) {
        currentModalAction = type;
        document.body.classList.add("modal-open");
        if (type === "bot") {
          modalTitle.textContent = "Switch to Bot?";
          modalDescription.textContent = "You are currently in a room. Do you want to leave and start a local game against the AI?";
        } else if (type === "resign") {
          modalTitle.textContent = "Resign Game?";
          modalDescription.textContent = "This will count as a loss. Are you sure you want to give up?";
        } else {
          modalTitle.textContent = "Leave Match?";
          modalDescription.textContent = "Your current game progress will be lost. Return to menu?";
        }
      } else {
        document.body.classList.remove("modal-open");
      }
      confirmDialog.hidden = !show;
    };
    backToMenuButton.addEventListener("click", () => {
      const gameEnded = Boolean(state.snapshot && (state.snapshot.checkmate || state.snapshot.draw || state.snapshot.winner !== null));
      if (gameEnded) {
        socket.emit("room:leave");
        clearLocalRoomState();
        render();
      } else {
        toggleConfirmModal(true, "leave");
      }
    });
    confirmNoBtn.addEventListener("click", () => toggleConfirmModal(false));
    confirmYesBtn.addEventListener("click", () => {
      const action = currentModalAction;
      document.body.classList.remove("modal-open");
      toggleConfirmModal(false);
      if (action === "bot") {
        socket.emit("room:leave");
        clearLocalRoomState();
        startBotGame();
      } else if (action === "resign") {
        if (state.gameMode === "multiplayer") {
          socket.emit("game:resign");
        } else if (state.snapshot) {
          state.snapshot.winner = state.role === "w" ? "b" : "w";
          state.snapshot.status = "Resigned";
          render();
        }
      } else if (action === "leave") {
        socket.emit("room:leave");
        clearLocalRoomState();
        render();
      }
    });
    focusModeButton.addEventListener("click", () => {
      void toggleFocusMode();
    });
    window.addEventListener("keydown", (e) => {
      if (isTypingTarget(e.target)) return;
      if (!state.snapshot || state.snapshot.moves.length === 0) return;
      const maxMoves = state.snapshot.moves.length;
      let currentPos = state.viewCursor !== null ? state.viewCursor : maxMoves;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentPos > 0) {
          state.viewCursor = currentPos - 1;
          render();
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (currentPos < maxMoves) {
          state.viewCursor = currentPos + 1;
          if (state.viewCursor === maxMoves) {
            state.viewCursor = null;
          }
          render();
        }
      }
    });
    window.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() !== "z" || isTypingTarget(event.target)) {
        return;
      }
      if (focusModeButton.hidden) {
        return;
      }
      event.preventDefault();
      void toggleFocusMode();
    });
    board.addEventListener("click", (event) => {
      const squareButton = event.target.closest(".square");
      const square = squareButton?.dataset.square;
      if (!square) {
        if (state.premoves.length > 0 || state.selectedSquare) {
          state.premoves = [];
          state.selectedSquare = null;
          state.legalTargets = [];
          requestBoardRefresh(true);
          updateCaption();
        }
        return;
      }
      if (lastPointerTapSquare === square && performance.now() - lastPointerTapAtMs < 250) {
        return;
      }
      if (lastDragCommitSquare === square && performance.now() - lastDragCommitAtMs < 250) {
        return;
      }
      clearArrows();
      onSquarePressed(square);
    });
    board.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (state.premoves.length > 0) {
        state.premoves = [];
        requestBoardRefresh();
        updateCaption();
      }
    });
    var ptrDragFrom = null;
    var ptrDragNode = null;
    var ptrDragMoved = false;
    var ptrStartX = 0;
    var ptrStartY = 0;
    var lastDragCommitSquare = null;
    var lastDragCommitAtMs = 0;
    var lastPointerTapSquare = null;
    var lastPointerTapAtMs = 0;
    var arrowDragFrom = null;
    var arrowDragTo = null;
    var arrowDragPointer = null;
    var arrowDragMoved = false;
    board.addEventListener("pointerdown", (event) => {
      if (event.button === 0 && (arrowAnnotations.size > 0 || squareAnnotations.size > 0)) {
        clearArrows();
      }
      const gameEnded = Boolean(state.snapshot && (state.snapshot.checkmate || state.snapshot.draw || state.snapshot.winner !== null));
      if (gameEnded) return;
      if (event.button === 2) {
        const square2 = getSquareFromPoint(event.clientX, event.clientY);
        if (!square2) return;
        arrowDragFrom = square2;
        arrowDragTo = null;
        arrowDragPointer = squareCenter(square2);
        arrowDragMoved = false;
        ptrStartX = event.clientX;
        ptrStartY = event.clientY;
        board.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
      if (event.button !== 0) return;
      const squareButton = event.target.closest(".square");
      const square = squareButton?.dataset.square;
      if (!square || !canStartMoveFrom(square)) return;
      ptrDragFrom = square;
      ptrDragMoved = false;
      ptrStartX = event.clientX;
      ptrStartY = event.clientY;
      board.setPointerCapture(event.pointerId);
    });
    board.addEventListener("pointermove", (event) => {
      if (arrowDragFrom) {
        const hoverSquare = getSquareFromPoint(event.clientX, event.clientY);
        arrowDragTo = hoverSquare && hoverSquare !== arrowDragFrom ? hoverSquare : null;
        arrowDragPointer = boardPointFromClient(event.clientX, event.clientY);
        renderArrows();
      }
      if (arrowDragFrom && !arrowDragMoved && Math.hypot(event.clientX - ptrStartX, event.clientY - ptrStartY) >= 5) {
        arrowDragMoved = true;
      }
      if (!ptrDragFrom) return;
      if (!ptrDragMoved && Math.hypot(event.clientX - ptrStartX, event.clientY - ptrStartY) < 5) return;
      if (!ptrDragMoved) {
        ptrDragMoved = true;
        state.selectedSquare = ptrDragFrom;
        const vBoard = getVirtualBoard();
        const virtualPiece = vBoard.get(ptrDragFrom);
        state.legalTargets = vBoard.moves({ square: ptrDragFrom, verbose: true }).map((m) => m.to);
        syncBoardInteractionState();
        updateCaption();
        const btn = board.querySelector(`[data-square="${ptrDragFrom}"]`);
        if (btn && virtualPiece) {
          const spritePath = PIECES[`${virtualPiece.color}${virtualPiece.type}`];
          ptrDragNode = document.createElement("img");
          ptrDragNode.src = spritePath;
          Object.assign(ptrDragNode.style, {
            position: "fixed",
            pointerEvents: "none",
            zIndex: "9999",
            width: `${btn.offsetWidth}px`,
            height: `${btn.offsetHeight}px`,
            transform: "translate(-50%, -50%)",
            opacity: "1"
          });
          document.body.append(ptrDragNode);
          btn.classList.add("dragging");
        }
      }
      if (ptrDragNode) {
        ptrDragNode.style.left = `${event.clientX}px`;
        ptrDragNode.style.top = `${event.clientY}px`;
      }
    });
    function endPointerDrag(event, commit) {
      const el = document.elementFromPoint(event.clientX, event.clientY);
      const squareButton = el?.closest(".square");
      const targetSquare = squareButton?.dataset.square;
      if (!ptrDragFrom) {
        if (commit && targetSquare && !ptrDragMoved) {
          lastPointerTapSquare = targetSquare;
          lastPointerTapAtMs = performance.now();
          onSquarePressed(targetSquare);
        }
        return;
      }
      const fromSquare = ptrDragFrom;
      const wasDrag = ptrDragMoved;
      ptrDragFrom = null;
      ptrDragMoved = false;
      if (ptrDragNode) {
        ptrDragNode.remove();
        ptrDragNode = null;
      }
      board.querySelector(".square.dragging")?.classList.remove("dragging");
      requestBoardRefresh(true);
      if (!wasDrag) {
        if (commit && targetSquare) {
          lastPointerTapSquare = targetSquare;
          lastPointerTapAtMs = performance.now();
          onSquarePressed(targetSquare);
        }
        return;
      }
      if (commit && targetSquare && targetSquare !== fromSquare) {
        clearSelection();
        suppressAnimationForMove = { from: fromSquare, to: targetSquare };
        tryMoveFromTo(fromSquare, targetSquare);
      }
    }
    function endArrowDrag(event, commit) {
      if (!arrowDragFrom) return;
      const fromSquare = arrowDragFrom;
      const previewTo = arrowDragTo;
      arrowDragFrom = null;
      arrowDragTo = null;
      arrowDragPointer = null;
      renderArrows();
      if (!commit) {
        arrowDragMoved = false;
        return;
      }
      const targetSquare = previewTo ?? getSquareFromPoint(event.clientX, event.clientY);
      if (!targetSquare) {
        arrowDragMoved = false;
        return;
      }
      if (!arrowDragMoved || targetSquare === fromSquare) {
        if (squareAnnotations.has(fromSquare)) {
          squareAnnotations.delete(fromSquare);
        } else {
          squareAnnotations.add(fromSquare);
        }
        arrowDragMoved = false;
        requestBoardRefresh(true);
        return;
      }
      toggleArrow(fromSquare, targetSquare);
      arrowDragMoved = false;
      renderArrows();
    }
    board.addEventListener("pointerup", (event) => {
      if (event.button === 2 || arrowDragFrom) {
        endArrowDrag(event, true);
        return;
      }
      endPointerDrag(event, true);
    });
    board.addEventListener("pointercancel", (event) => {
      endArrowDrag(event, false);
      endPointerDrag(event, false);
    });
    async function triggerBotResponse() {
      if (!liveAnalyzer) liveAnalyzer = new StockfishBridge();
      const botMoveUci = await liveAnalyzer.getBotMove(chess.fen());
      const bFrom = botMoveUci.substring(0, 2);
      const bTo = botMoveUci.substring(2, 4);
      const bPromo = botMoveUci.length === 5 ? botMoveUci[4] : "q";
      const bMove = chess.move({ from: bFrom, to: bTo, promotion: bPromo });
      if (bMove && state.snapshot) {
        updateManualSnapshot(bMove);
        playSoundForSnapshot(state.snapshot);
        if (state.premoves.length > 0) {
          checkAndExecutePremove();
        }
        requestBoardRefresh(true);
        if (state.snapshot.analysis.enabled) {
          void maybeRunLiveAnalysis(state.snapshot);
        }
      }
    }
    promotionDialog.addEventListener("click", (event) => {
      const button = event.target.closest("[data-promotion]");
      if (!button || !state.pendingPromotion) return;
      const promotion = button.dataset.promotion;
      const { from, to } = state.pendingPromotion;
      if (state.gameMode === "bot") {
        let moveResult = null;
        try {
          moveResult = chess.move({ from, to, promotion });
        } catch (e) {
          console.warn("Invalid promotion move attempted");
        }
        state.pendingPromotion = null;
        promotionDialog.hidden = true;
        if (moveResult) {
          updateManualSnapshot(moveResult);
          suppressAnimationForMove = { from, to };
          render();
          playSoundForSnapshot(state.snapshot);
          if (!state.snapshot.checkmate && !state.snapshot.draw) {
            triggerBotResponse();
          }
        } else {
          requestBoardRefresh(true);
        }
      } else {
        socket.emit("game:move", { from, to, promotion });
        state.pendingPromotion = null;
        promotionDialog.hidden = true;
      }
    });
    function onSocketConnect() {
      state.connected = true;
      if (state.autoJoinCode) {
        if (ROOM_ID_PATTERN.test(state.autoJoinCode)) {
          socket.emit("room:join", { roomId: state.autoJoinCode });
        }
        state.autoJoinCode = null;
      }
    }
    socket.on("connect", onSocketConnect);
    if (socket.connected) onSocketConnect();
    socket.on("disconnect", () => {
      state.connected = false;
    });
    socket.on("connection:status", () => {
      state.connected = true;
    });
    socket.on("session:joined", (payload) => {
      state.roomId = payload.roomId;
      state.role = payload.role;
      state.shareUrl = payload.shareUrl || `${window.location.origin}/?room=${payload.roomId}`;
      roomInput.value = payload.roomId;
      localStorage.setItem("chess_roomId", payload.roomId);
      if (payload.role === "w" || payload.role === "b") {
        state.orientation = payload.role;
      }
      syncUrl(payload.roomId);
      render();
    });
    socket.on("session:left", () => {
      if (state.gameMode === "bot") return;
      clearLocalRoomState();
      render();
    });
    socket.on("room:state", (snapshot) => {
      lastRoomStateReceivedAtMs = Date.now();
      const previousSnapshot = state.snapshot;
      const previousMoveCount = state.snapshot?.moveCount ?? 0;
      const previousTurn = state.snapshot?.turn ?? null;
      const previousStatus = state.snapshot?.status ?? "";
      const previousWinner = state.snapshot?.winner ?? null;
      const previousCheckmate = state.snapshot?.checkmate ?? false;
      const previousDraw = state.snapshot?.draw ?? false;
      const previousAnalysisEnabled = state.snapshot?.analysis.enabled ?? false;
      const previousSelectedSquare = state.selectedSquare;
      const previousLegalTargetsKey = state.legalTargets.join(",");
      const previousFen = chess.fen();
      let boardRefreshForcedByArrowClear = false;
      state.snapshot = snapshot;
      chess.load(snapshot.fen);
      const isActuallyNewMove = _lastPlayedMoveCount !== -1 && snapshot.moveCount > _lastPlayedMoveCount;
      _lastPlayedMoveCount = snapshot.moveCount;
      if (isActuallyNewMove) {
        playSoundForSnapshot(snapshot);
        if (snapshot.check) triggerCheckFlash();
      }
      const capturedByCount = countFenPieces(snapshot.fen) < countFenPieces(previousFen);
      if (state.bloodFxEnabled && isActuallyNewMove && capturedByCount && snapshot.lastMove) {
        const capturedPiece = detectCapturedPiece(previousFen, snapshot.lastMove);
        spawnBloodSplatter(snapshot.lastMove.to, capturedPiece ?? "p");
      }
      if (snapshot.moveCount > previousMoveCount) {
        boardRefreshForcedByArrowClear = clearArrows();
      }
      if (state.selectedSquare) {
        const currentPiece = chess.get(state.selectedSquare);
        if (!currentPiece || !isOwnPiece(currentPiece.color)) {
          clearSelection();
        } else {
          state.legalTargets = snapshot.turn === state.role ? legalTargetsFor(state.selectedSquare) : legalTargetsForRole(state.selectedSquare, state.role);
        }
      }
      if (!snapshot.analysis.enabled) {
        const labelsOnlyMode = snapshot.analysis.labelsOnly && isLiveAnalysisLocked(snapshot);
        if (!labelsOnlyMode) {
          state.lastAnalyzedMoveKey = null;
          state.liveMoveGrades = {};
          liveAnalysisToken += 1;
        }
      }
      if (state.role && state.role !== "spectator" && snapshot.turn === state.role && state.premoves.length > 0) {
        const nextMove = state.premoves.shift();
        if (nextMove) {
          const isLegal = chess.moves({ verbose: true }).some((m) => m.from === nextMove.from && m.to === nextMove.to);
          if (isLegal && !snapshot.checkmate && !snapshot.draw) {
            suppressAnimationForMove = { from: nextMove.from, to: nextMove.to };
            socket.emit("game:move", nextMove.promotion ? nextMove : { from: nextMove.from, to: nextMove.to });
            void maybeRunLiveAnalysis(snapshot);
            return;
          } else {
            state.premoves = [];
          }
        }
      }
      const legalTargetsChanged = previousLegalTargetsKey !== state.legalTargets.join(",");
      const boardStateChanged = previousFen !== snapshot.fen || previousMoveCount !== snapshot.moveCount || previousTurn !== snapshot.turn || previousStatus !== snapshot.status || previousWinner !== snapshot.winner || previousCheckmate !== snapshot.checkmate || previousDraw !== snapshot.draw || previousAnalysisEnabled !== snapshot.analysis.enabled || previousSelectedSquare !== state.selectedSquare || legalTargetsChanged || previousSnapshot === null;
      if (!boardRefreshForcedByArrowClear && boardStateChanged) {
        requestBoardRefresh();
      }
      renderSession();
      renderMoves();
      updateCaption();
      updateFocusHud();
      void maybeRunLiveAnalysis(snapshot);
      void maybeUpdateBestMoveArrow(snapshot);
    });
    socket.on("room:error", (payload) => {
      suppressAnimationForMove = null;
      if (state.autoJoinCode) {
        state.autoJoinCode = null;
        syncUrl(null);
        return;
      }
      showToast(payload.message);
    });
    socket.on("undo:requested", () => {
      showToast("Opponent requested an undo.");
    });
    socket.on("undo:accepted", () => {
      showToast("Undo request accepted.");
    });
    socket.on("undo:declined", () => {
      showToast("Undo request declined.");
    });
    function must(selector) {
      const element = document.querySelector(selector);
      if (!element) {
        throw new Error(`Missing element: ${selector}`);
      }
      return element;
    }
    function render(force = false) {
      const savedScroll = window.scrollY;
      requestBoardRefresh(force);
      renderSession();
      renderMoves();
      updateCaption();
      updateFocusHud();
      if (state.snapshot?.analysis.enabled) {
        void maybeRunLiveAnalysis(state.snapshot);
      }
      requestAnimationFrame(() => {
        if (window.scrollY !== savedScroll) {
          window.scrollTo({ top: savedScroll, behavior: "instant" });
        }
      });
    }
    var trailRafId = null;
    function startTrailSpawning() {
      if (!state.trailFxEnabled) return;
      let lastSpawnTime = 0;
      const spawnRateMs = 12;
      function spawn() {
        const movingNode = activeGhostNode || ptrDragNode;
        if (!movingNode) {
          trailRafId = null;
          return;
        }
        const now = performance.now();
        if (now - lastSpawnTime > spawnRateMs) {
          createTrailParticle(movingNode);
          lastSpawnTime = now;
        }
        trailRafId = requestAnimationFrame(spawn);
      }
      if (trailRafId) cancelAnimationFrame(trailRafId);
      trailRafId = requestAnimationFrame(spawn);
    }
    function createTrailParticle(sourceNode) {
      const rect = sourceNode.getBoundingClientRect();
      const particle = document.createElement("div");
      particle.className = "piece-trail-particle";
      const img = sourceNode.querySelector("img");
      if (img) {
        const imgEl = document.createElement("img");
        imgEl.src = img.src;
        imgEl.className = "piece-image";
        particle.appendChild(imgEl);
      }
      particle.style.left = `${rect.left + window.scrollX}px`;
      particle.style.top = `${rect.top + window.scrollY}px`;
      particle.style.width = `${rect.width}px`;
      particle.style.height = `${rect.height}px`;
      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 250);
    }
    function renderSession() {
      const snapshot = state.snapshot;
      const hasRoom = Boolean(state.roomId);
      const isCreator = Boolean(snapshot?.ownerId && socket.id && snapshot.ownerId === socket.id);
      const isMultiplayer = state.gameMode === "multiplayer";
      const bothConnected = Boolean(snapshot?.players.whiteConnected && snapshot?.players.blackConnected);
      const isGameActive = Boolean(
        isMultiplayer && bothConnected && snapshot?.isStarted || state.gameMode === "bot" && snapshot !== null
      );
      const canVote = state.role === "w" || state.role === "b";
      const gameEnded = Boolean(snapshot && (snapshot.checkmate || snapshot.draw || snapshot.winner !== null));
      const analysisLocked = Boolean(snapshot?.analysis.locked && state.gameMode === "multiplayer");
      const maxMoves = snapshot?.moves.length ?? 0;
      gameNavRow.hidden = !isGameActive || maxMoves === 0;
      roomBadge.textContent = state.roomId ? `Room ${state.roomId}` : "No active room";
      roleBadge.textContent = humanRole(state.role);
      shareLink.textContent = state.shareUrl || "Create or join a room to get a live invite link.";
      const heroCopy = document.querySelector(".hero-copy");
      if (heroCopy) heroCopy.hidden = isGameActive;
      inviteJoinCard.hidden = isGameActive;
      createRoomButton.hidden = isGameActive;
      playBotButton.hidden = isGameActive;
      leaveRoomButton.hidden = !hasRoom;
      joinGrid.hidden = hasRoom;
      copyLinkButton.hidden = !state.shareUrl || isGameActive;
      flipBoardButton.hidden = !isGameActive;
      focusModeButton.hidden = !isGameActive;
      gameNav.hidden = !isGameActive;
      seatCard.hidden = !hasRoom;
      summaryCard.hidden = !isGameActive;
      movesCard.hidden = !isGameActive;
      liveAnalysisButton.hidden = !isGameActive || !canVote || state.gameMode === "bot" || state.gameMode === "multiplayer" && analysisLocked;
      labelsOnlyButton.hidden = !isGameActive || !canVote;
      undoRequestButton.hidden = !isGameActive || !canVote || state.gameMode !== "multiplayer";
      undoDeclineButton.hidden = true;
      rematchButton.hidden = !gameEnded || !canVote || !hasRoom;
      resignButton.hidden = !isGameActive || gameEnded || !canVote;
      if (!isGameActive && state.focusMode) {
        state.focusMode = false;
        applyFocusMode();
      }
      if (!snapshot) {
        pregamePlaceholder.hidden = false;
        pregameWaiting.hidden = false;
        pregameSelection.hidden = true;
        matchStatus.textContent = "Create a room to start.";
        whiteSeat.textContent = "Waiting for player";
        blackSeat.textContent = "Waiting for player";
        turnMeta.textContent = "White";
        movesMeta.textContent = "0";
        spectatorMeta.textContent = "0";
        whiteClock.textContent = "03:00";
        blackClock.textContent = "03:00";
        whiteClock.classList.remove("is-low");
        blackClock.classList.remove("is-low");
        modeHint.textContent = "Room creator selects the timer. Color choice and ready are still required.";
        summaryText.textContent = "Ready to play.";
        liveAnalysisText.textContent = "Live analysis disabled.";
        updateFocusHud();
        return;
      }
      pregamePlaceholder.hidden = isGameActive;
      if (isMultiplayer && !isGameActive) {
        const canConfigurePregame = state.role === "w" || state.role === "b";
        pregameSelection.hidden = !canConfigurePregame;
        pregameWaiting.hidden = canConfigurePregame;
        if (canConfigurePregame) {
          const isWhiteSeat = state.role === "w";
          const myChoice = isWhiteSeat ? snapshot.pregame.p1Choice : snapshot.pregame.p2Choice;
          const opChoice = isWhiteSeat ? snapshot.pregame.p2Choice : snapshot.pregame.p1Choice;
          const myReady = isWhiteSeat ? snapshot.pregame.p1Ready : snapshot.pregame.p2Ready;
          const opReady = isWhiteSeat ? snapshot.pregame.p2Ready : snapshot.pregame.p1Ready;
          const opponentConnected = isWhiteSeat ? snapshot.players.blackConnected : snapshot.players.whiteConnected;
          const selectedMode = snapshot.timeControl.id;
          modeBlitz3.classList.toggle("selected", selectedMode === "blitz3");
          modeRapid10.classList.toggle("selected", selectedMode === "rapid10");
          modeBlitz3p2.classList.toggle("selected", selectedMode === "blitz3p2");
          modeBlitz3.disabled = !isCreator;
          modeRapid10.disabled = !isCreator;
          modeBlitz3p2.disabled = !isCreator;
          if (isCreator) {
            modeHint.textContent = `You are the room creator. Current mode: ${snapshot.timeControl.label}.`;
          } else {
            modeHint.textContent = `Room creator controls mode. Current mode: ${snapshot.timeControl.label}.`;
          }
          myPickWhite.classList.toggle("selected", myChoice === "w");
          myPickBlack.classList.toggle("selected", myChoice === "b");
          opPickWhite.classList.toggle("selected", opChoice === "w");
          opPickBlack.classList.toggle("selected", opChoice === "b");
          opPickWhite.classList.toggle("disabled", !opponentConnected);
          opPickBlack.classList.toggle("disabled", !opponentConnected);
          myReadyBadge.classList.toggle("is-ready", myReady);
          opReadyBadge.classList.toggle("is-ready", opReady);
          const hasConflict = myChoice !== null && opChoice !== null && myChoice === opChoice;
          pregameConflictWarning.hidden = !hasConflict;
          pregameReadyBtn.hidden = false;
          pregameReadyBtn.disabled = !bothConnected || myChoice === null || hasConflict || myReady;
          if (!bothConnected || myReady) {
            pregameReadyBtn.textContent = "Waiting for Opponent...";
          } else {
            pregameReadyBtn.textContent = "Ready to Play";
          }
          if (!bothConnected) {
            pregameConflictWarning.hidden = true;
          }
        } else {
          pregameReadyBtn.hidden = true;
        }
      } else {
        modeBlitz3.disabled = true;
        modeRapid10.disabled = true;
        modeBlitz3p2.disabled = true;
        pregameReadyBtn.hidden = state.role === "spectator";
      }
      matchStatus.textContent = snapshot.status;
      whiteSeat.textContent = snapshot.players.whiteConnected ? seatLabel("w") : "Waiting for player";
      blackSeat.textContent = snapshot.players.blackConnected ? seatLabel("b") : "Waiting for player";
      turnMeta.textContent = snapshot.turn === "w" ? "White" : "Black";
      movesMeta.textContent = String(snapshot.moveCount);
      spectatorMeta.textContent = String(snapshot.players.spectatorCount);
      const whiteMs = getDisplayClockMs(snapshot, "w");
      const blackMs = getDisplayClockMs(snapshot, "b");
      whiteClock.textContent = formatClockMs(whiteMs);
      blackClock.textContent = formatClockMs(blackMs);
      whiteClock.classList.toggle("is-low", snapshot.isStarted && whiteMs <= snapshot.clock.lowTimeThresholdMs);
      blackClock.classList.toggle("is-low", snapshot.isStarted && blackMs <= snapshot.clock.lowTimeThresholdMs);
      const roleDescription = state.role === "spectator" ? "Spectating." : state.role ? `Playing ${state.role === "w" ? "White" : "Black"}.` : "Not seated.";
      const lastMoveDescription = snapshot.lastMove ? ` Last move: ${snapshot.lastMove.san} (${snapshot.lastMove.from} to ${snapshot.lastMove.to}).` : "";
      const rematchDescription = state.gameMode === "multiplayer" && snapshot.rematchVotes > 0 ? ` Rematch votes: ${snapshot.rematchVotes}/2.` : "";
      const undoDescription = snapshot.undo.pending ? ` Undo request pending (${snapshot.undo.requester === "w" ? "White" : snapshot.undo.requester === "b" ? "Black" : "Unknown"}).` : "";
      summaryText.textContent = `${roleDescription} ${snapshot.status}${lastMoveDescription}${rematchDescription}${undoDescription}`.trim();
      if (state.gameMode === "bot") {
        labelsOnlyButton.textContent = snapshot.analysis.enabled ? "Move badges: On" : "Move badges: Off";
        labelsOnlyButton.disabled = false;
      } else {
        const seatedPlayers = Number(snapshot.players.whiteConnected) + Number(snapshot.players.blackConnected);
        liveAnalysisButton.disabled = seatedPlayers < 2 || !canVote;
        liveAnalysisButton.textContent = snapshot.analysis.enabled ? "Disable analysis" : `Enable analysis (${snapshot.analysis.votes}/2)`;
        if (snapshot.analysis.labelsOnly) {
          labelsOnlyButton.textContent = "Labels only: On";
          labelsOnlyButton.disabled = false;
        } else {
          labelsOnlyButton.textContent = `Show Badges (${snapshot.analysis.labelsVotes}/2)`;
          labelsOnlyButton.disabled = seatedPlayers < 2;
        }
      }
      if (!undoRequestButton.hidden) {
        const canRequestUndo = snapshot.moveCount > 0 && !gameEnded;
        const pendingUndo = snapshot.undo.pending;
        const requester = snapshot.undo.requester;
        if (!pendingUndo) {
          undoRequestButton.textContent = "Request undo";
          undoRequestButton.disabled = !canRequestUndo;
        } else if (requester && requester !== state.role) {
          undoRequestButton.textContent = "Accept undo";
          undoRequestButton.disabled = false;
          undoDeclineButton.hidden = false;
          undoDeclineButton.disabled = false;
        } else {
          undoRequestButton.textContent = "Undo requested...";
          undoRequestButton.disabled = true;
        }
      }
      rematchButton.disabled = !gameEnded;
      if (snapshot.analysis.enabled) {
        liveAnalysisText.textContent = state.liveAnalysisSummary;
      } else if (analysisLocked && snapshot.analysis.labelsOnly) {
        liveAnalysisText.textContent = state.liveAnalysisSummary || "Labels-only mode active. Best lines are hidden.";
      } else if (analysisLocked && state.gameMode === "multiplayer" && snapshot.analysis.labelsVotes > 0) {
        liveAnalysisText.textContent = `Labels-only vote pending: ${snapshot.analysis.labelsVotes}/2.`;
      } else if (analysisLocked) {
        liveAnalysisText.textContent = "Live analysis and best-move arrows are disabled during active multiplayer games.";
      } else if (state.gameMode === "multiplayer" && snapshot.analysis.votes > 0) {
        liveAnalysisText.textContent = `Waiting for both players: ${snapshot.analysis.votes}/2 ready.`;
      } else {
        liveAnalysisText.textContent = "Live analysis disabled.";
      }
      if (!gameEnded) {
        const existingOverlay = document.querySelector(".game-over-overlay");
        if (existingOverlay) existingOverlay.remove();
      }
      updateFocusHud();
    }
    function cancelCurrentDrag() {
      if (ptrDragNode) {
        ptrDragNode.remove();
        ptrDragNode = null;
      }
      if (ptrDragFrom) {
        const draggedSquareEl = board.querySelector(`[data-square="${ptrDragFrom}"]`);
        draggedSquareEl?.classList.remove("dragging");
        ptrDragFrom = null;
      }
      ptrDragMoved = false;
      state.selectedSquare = null;
      state.legalTargets = [];
    }
    function getDisplayBoard() {
      if (state.viewCursor === null || !state.snapshot) {
        return state.premoves.length > 0 ? getVirtualBoard() : chess;
      }
      const historyBoard = new Chess();
      for (let i = 0; i < state.viewCursor; i++) {
        const move = state.snapshot.moves[i];
        if (move) historyBoard.move(move.san);
      }
      return historyBoard;
    }
    function renderBoard() {
      if (ptrDragFrom) {
        const pieceAtSource = chess.get(ptrDragFrom);
        if (!pieceAtSource || pieceAtSource.color !== state.role) {
          cancelCurrentDrag();
        }
      }
      const fragment = document.createDocumentFragment();
      const squares = buildSquareList(state.orientation);
      const isHistoryView = state.viewCursor !== null;
      const displayBoard = getDisplayBoard();
      let lastMove = state.snapshot?.lastMove ?? null;
      if (isHistoryView && state.snapshot && state.viewCursor !== null && state.viewCursor > 0) {
        lastMove = state.snapshot.moves[state.viewCursor - 1] ?? null;
      } else if (isHistoryView && state.viewCursor === 0) {
        lastMove = null;
      }
      const lastMoveSquares = /* @__PURE__ */ new Set();
      if (lastMove) {
        lastMoveSquares.add(lastMove.from);
        lastMoveSquares.add(lastMove.to);
      }
      let checkedKingSquare = null;
      if (displayBoard.isCheck()) {
        const checkedColor = displayBoard.turn();
        for (const sqName of squares) {
          const p = displayBoard.get(sqName);
          if (p?.type === "k" && p.color === checkedColor) {
            checkedKingSquare = sqName;
            break;
          }
        }
      }
      const liveGrade = state.snapshot && (state.snapshot.analysis.enabled || state.snapshot.analysis.labelsOnly) && state.snapshot.lastMove ? state.liveMoveGrades[state.snapshot.moveCount] : void 0;
      const liveMarkerSquare = !isHistoryView && liveGrade && state.snapshot?.lastMove ? state.snapshot.lastMove.to : null;
      for (const squareName of squares) {
        const square = squareName;
        const piece = displayBoard.get(square);
        const button = document.createElement("button");
        button.type = "button";
        button.tabIndex = -1;
        button.className = `square ${isLightSquare(squareName) ? "light" : "dark"}`;
        button.dataset.square = squareName;
        if (lastMoveSquares.has(squareName)) button.classList.add("last-move");
        if (checkedKingSquare === squareName) button.classList.add("in-check");
        if (squareAnnotations.has(squareName)) button.classList.add("highlight-red");
        if (!gameNavRow.hidden) {
          const isHistoryView2 = state.viewCursor !== null;
          const maxMoves = state.snapshot?.moves.length ?? 0;
          const currentPos = isHistoryView2 ? state.viewCursor : maxMoves;
          liveNavFirst.disabled = currentPos === 0;
          liveNavPrev.disabled = currentPos === 0;
          liveNavNext.disabled = currentPos === maxMoves;
          liveNavLast.disabled = currentPos === maxMoves;
        }
        if (!isHistoryView && state.selectedSquare === square) button.classList.add("selected");
        if (!isHistoryView && state.legalMovesEnabled && state.legalTargets.includes(square)) button.classList.add("legal");
        if (lastMoveSquares.has(squareName)) button.classList.add("last-move");
        if (checkedKingSquare === squareName) button.classList.add("in-check");
        if (square === ptrDragFrom) button.classList.add("dragging");
        if (!isHistoryView) {
          state.premoves.forEach((p) => {
            if (p.from === square) button.classList.add("premove-from");
            if (p.to === square) {
              button.classList.add("premove-to");
              if (piece) button.classList.add("premove-capture");
            }
          });
        }
        if (piece) {
          const spritePath = PIECES[`${piece.color}${piece.type}`];
          const pieceElement = document.createElement("span");
          pieceElement.className = `piece piece-${piece.type} ${piece.color === "w" ? "white" : "black"}`;
          const isMyPremove = suppressAnimationForMove && square === suppressAnimationForMove.to;
          const isTargetOfActiveAnimation = square === animatingToSquare && !animationFinished;
          const isBeingDragged = square === ptrDragFrom;
          const shouldHide = isTargetOfActiveAnimation && activeGhostNode || isBeingDragged;
          if (shouldHide && !isMyPremove && !isHistoryView) {
            pieceElement.style.opacity = "0";
            pieceElement.style.visibility = "hidden";
            pieceElement.style.pointerEvents = "none";
          } else {
            pieceElement.style.opacity = "1";
            pieceElement.style.visibility = "";
            pieceElement.style.pointerEvents = "";
          }
          if (isMyPremove) pieceElement.style.transition = "none";
          const pieceImage = document.createElement("img");
          pieceImage.className = "piece-image";
          pieceImage.src = spritePath;
          pieceImage.draggable = false;
          pieceElement.append(pieceImage);
          button.append(pieceElement);
          if (liveGrade && liveMarkerSquare === squareName) {
            const marker = document.createElement("span");
            marker.className = `piece-quality-marker ${liveGrade.category}`;
            marker.textContent = symbolForLiveCategory(liveGrade.category);
            button.append(marker);
          }
        }
        fragment.append(button);
      }
      board.replaceChildren(fragment);
      if (!isHistoryView) {
        const isPremoveExecution = suppressAnimationForMove && lastMove && lastMove.from === suppressAnimationForMove.from && lastMove.to === suppressAnimationForMove.to;
        if (isPremoveExecution) {
          lastAnimatedMoveKey = `${state.snapshot.moveCount}:${lastMove.from}:${lastMove.to}:${lastMove.san}`;
          suppressAnimationForMove = null;
          animationFinished = true;
          requestAnimationFrame(() => renderBoard());
        } else if (lastMove) {
          const moveKey = `${state.snapshot.moveCount}:${lastMove.from}:${lastMove.to}:${lastMove.san}`;
          if (lastAnimatedMoveKey !== moveKey) {
            if (state.animationStyle === "epic") animateLastMoveEpic(lastMove);
            else animateLastMove(lastMove);
          }
        }
      } else {
        if (activeGhostAnimation) {
          const tempAnim = activeGhostAnimation;
          activeGhostAnimation = null;
          tempAnim.cancel();
        }
      }
      renderArrows();
      const snapshot = state.snapshot;
      const gameEnded = Boolean(snapshot && (snapshot.checkmate || snapshot.draw || snapshot.winner !== null));
      if (gameEnded && snapshot && !isHistoryView) {
        const overlay = document.createElement("div");
        overlay.className = "game-over-overlay";
        const banner = document.createElement("div");
        banner.className = "game-over-banner";
        const title = document.createElement("h2");
        title.className = "game-over-title";
        if (snapshot.checkmate) title.textContent = snapshot.winner === "w" ? "White Wins!" : "Black Wins!";
        else if (snapshot.draw) title.textContent = "Draw";
        else if (snapshot.winner) title.textContent = snapshot.winner === "w" ? "White Wins" : "Black Wins";
        const reason = document.createElement("p");
        reason.className = "game-over-reason";
        reason.textContent = snapshot.status;
        const actionContainer = document.createElement("div");
        actionContainer.className = "game-over-actions";
        const overlayRematchBtn = document.createElement("button");
        overlayRematchBtn.className = "action cta-turquoise";
        overlayRematchBtn.textContent = state.gameMode === "bot" ? "Play Again" : "Request Rematch";
        overlayRematchBtn.onclick = () => {
          if (state.gameMode === "bot") startBotGame();
          else socket.emit("game:rematch");
        };
        const overlayAnalyzeBtn = document.createElement("a");
        overlayAnalyzeBtn.className = "action cta-rainbow";
        overlayAnalyzeBtn.style.textDecoration = "none";
        overlayAnalyzeBtn.onclick = () => {
          localStorage.setItem("postGameMoves", JSON.stringify(snapshot.moves.map((m) => m.san)));
          window.location.href = "/analyze";
        };
        overlayAnalyzeBtn.textContent = "Analyze Game";
        actionContainer.append(overlayRematchBtn, overlayAnalyzeBtn);
        banner.append(title, reason, actionContainer);
        overlay.append(banner);
        board.append(overlay);
      }
    }
    function getSquareFromPoint(clientX, clientY) {
      const node2 = document.elementFromPoint(clientX, clientY);
      const squareButton = node2?.closest(".square");
      return squareButton?.dataset.square ?? null;
    }
    function boardPointFromClient(clientX, clientY) {
      const rect = board.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return { x: 400, y: 400 };
      }
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const clampedX = Math.max(0, Math.min(rect.width, localX));
      const clampedY = Math.max(0, Math.min(rect.height, localY));
      return {
        x: clampedX / rect.width * 800,
        y: clampedY / rect.height * 800
      };
    }
    function squareCenter(square) {
      const file2 = square.charCodeAt(0) - 97;
      const rank2 = Number(square[1]) - 1;
      const col = state.orientation === "w" ? file2 : 7 - file2;
      const row = state.orientation === "w" ? 7 - rank2 : rank2;
      return {
        x: col * 100 + 50,
        y: row * 100 + 50
      };
    }
    function countFenPieces(fen) {
      const boardFen = fen.split(" ")[0] ?? "";
      let count = 0;
      for (const ch of boardFen) {
        if (/[prnbqkPRNBQK]/.test(ch)) {
          count += 1;
        }
      }
      return count;
    }
    function detectCapturedPiece(previousFen, lastMove) {
      const replay = new Chess(previousFen);
      const promotionMatch = lastMove.san.match(/=([QRBN])/);
      const promotion = promotionMatch?.[1]?.toLowerCase();
      let move = null;
      try {
        move = replay.move(
          promotion ? { from: lastMove.from, to: lastMove.to, promotion } : { from: lastMove.from, to: lastMove.to }
        );
      } catch {
        return null;
      }
      return move?.captured ?? null;
    }
    function triggerCheckFlash() {
      const flash = document.createElement("div");
      flash.className = "check-flash-overlay";
      document.body.append(flash);
      flash.addEventListener("animationend", () => flash.remove(), { once: true });
    }
    function spawnBloodSplatter(square, capturedPiece) {
      const boardWrap = board.parentElement;
      if (!boardWrap) return;
      const intensityByPiece = {
        p: 0.6,
        n: 0.8,
        b: 0.8,
        r: 1,
        q: 1.4,
        k: 1.2
      };
      const intensity = intensityByPiece[capturedPiece] ?? 0.8;
      const center = squareCenter(square);
      const splatter = document.createElement("div");
      splatter.className = "capture-splatter";
      splatter.style.left = `${center.x / 800 * 100}%`;
      splatter.style.top = `${center.y / 800 * 100}%`;
      splatter.style.setProperty("--intensity", String(intensity));
      const dropCount = Math.floor(4 + Math.random() * 6 * intensity);
      for (let index = 0; index < dropCount; index += 1) {
        const drop = document.createElement("span");
        drop.className = "capture-drop";
        const angle = Math.random() * Math.PI * 2;
        const distance = (20 + Math.random() * 40) * intensity;
        const size = (6 + Math.random() * 10) * intensity;
        drop.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
        drop.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
        drop.style.setProperty("--size", `${size}px`);
        drop.style.setProperty("--delay", `${Math.random() * 50}ms`);
        splatter.append(drop);
      }
      boardWrap.append(splatter);
      setTimeout(() => splatter.remove(), 2500);
    }
    function toggleArrow(from, to) {
      const key = `${from}-${to}`;
      if (arrowAnnotations.has(key)) {
        arrowAnnotations.delete(key);
        return;
      }
      arrowAnnotations.add(key);
    }
    function clearArrows() {
      if (arrowAnnotations.size === 0 && squareAnnotations.size === 0) {
        return false;
      }
      arrowAnnotations.clear();
      squareAnnotations.clear();
      renderArrows();
      requestBoardRefresh(true);
      return true;
    }
    function isSnapshotGameOver(snapshot) {
      return snapshot.checkmate || snapshot.draw || snapshot.winner !== null;
    }
    function isLiveAnalysisLocked(snapshot) {
      return state.gameMode === "multiplayer" && snapshot.analysis.locked;
    }
    function isLabelsOnlyMode(snapshot) {
      return isLiveAnalysisLocked(snapshot) && snapshot.analysis.labelsOnly;
    }
    function isBotBadgesMode(snapshot) {
      return state.gameMode === "bot" && snapshot.analysis.enabled;
    }
    function clearBestMoveArrow() {
      if (!state.bestMoveArrow && !state.bestMoveArrowFen) {
        return;
      }
      bestMoveArrowToken += 1;
      state.bestMoveArrow = null;
      state.bestMoveArrowFen = null;
      renderArrows();
    }
    async function maybeUpdateBestMoveArrow(snapshot) {
      if (!snapshot) {
        clearBestMoveArrow();
        return;
      }
      if (isLiveAnalysisLocked(snapshot) || isBotBadgesMode(snapshot)) {
        clearBestMoveArrow();
        return;
      }
      const shouldShow = canShowBestMoveArrow(snapshot.analysis.enabled, isSnapshotGameOver(snapshot));
      if (!shouldShow) {
        clearBestMoveArrow();
        return;
      }
      if (state.bestMoveArrowFen === snapshot.fen) {
        return;
      }
      const token = ++bestMoveArrowToken;
      try {
        if (!liveAnalyzer) {
          liveAnalyzer = new StockfishBridge();
        }
        const evaluation = await liveAnalyzer.evaluateFen(snapshot.fen, 10);
        if (token !== bestMoveArrowToken) {
          return;
        }
        state.bestMoveArrow = parseBestMoveArrow(evaluation.bestMove);
        state.bestMoveArrowFen = snapshot.fen;
      } catch {
        if (token !== bestMoveArrowToken) {
          return;
        }
        state.bestMoveArrow = null;
        state.bestMoveArrowFen = snapshot.fen;
      }
      renderArrows();
    }
    function renderArrows() {
      const snapshot = state.snapshot;
      const bestMove = snapshot && !isLiveAnalysisLocked(snapshot) && !isBotBadgesMode(snapshot) && canShowBestMoveArrow(snapshot.analysis.enabled, isSnapshotGameOver(snapshot)) ? state.bestMoveArrow : null;
      arrowLayer.innerHTML = buildArrowLayerMarkup({
        variant: "board",
        annotations: arrowAnnotations,
        preview: arrowDragFrom && arrowDragPointer ? { from: arrowDragFrom, pointer: arrowDragPointer } : null,
        bestMove,
        squareCenter
      });
    }
    function syncBoardInteractionState() {
      for (const squareButton of board.querySelectorAll(".square")) {
        const square = squareButton.dataset.square;
        if (!square) {
          continue;
        }
        squareButton.classList.toggle("selected", state.selectedSquare === square);
        squareButton.classList.toggle("legal", state.legalMovesEnabled && state.legalTargets.includes(square));
        squareButton.classList.toggle("dragging", square === ptrDragFrom);
      }
    }
    function checkAndExecutePremove() {
      const snapshot = state.snapshot;
      if (!snapshot || !state.role || state.role === "spectator") return;
      if (snapshot.turn === state.role && state.premoves.length > 0) {
        const nextMove = state.premoves.shift();
        if (nextMove) {
          const isLegal = chess.moves({ verbose: true }).some((m) => m.from === nextMove.from && m.to === nextMove.to);
          if (isLegal && !snapshot.checkmate && !snapshot.draw) {
            suppressAnimationForMove = { from: nextMove.from, to: nextMove.to };
            animationFinished = true;
            tryMoveFromTo(nextMove.from, nextMove.to);
            requestBoardRefresh(true);
          } else {
            state.premoves = [];
          }
        }
      }
    }
    function renderMoves() {
      const snapshot = state.snapshot;
      if (!snapshot || snapshot.moves.length === 0) {
        moveList.innerHTML = '<div class="empty-state">No moves yet.</div>';
        return;
      }
      const rows = [];
      for (let index = 0; index < snapshot.moves.length; index += 2) {
        const whiteMove = snapshot.moves[index];
        const blackMove = snapshot.moves[index + 1];
        const whitePly = index + 1;
        const blackPly = index + 2;
        const whiteGrade = state.liveMoveGrades[whitePly];
        const blackGrade = state.liveMoveGrades[blackPly];
        const whiteBadge = whiteMove && whiteGrade ? ` <span class="move-quality-tag ${whiteGrade.category}">${whiteGrade.label}</span>` : "";
        const blackBadge = blackMove && blackGrade ? ` <span class="move-quality-tag ${blackGrade.category}">${blackGrade.label}</span>` : "";
        const moveNumber = Math.floor(index / 2) + 1;
        const wActiveStyle = state.viewCursor === whitePly ? "background: var(--accent); color: #fffdf8;" : "";
        const bActiveStyle = state.viewCursor === blackPly ? "background: var(--accent); color: #fffdf8;" : "";
        rows.push(`
      <div class="move-row">
        <strong>${moveNumber}.</strong>
        <span class="move-clickable" data-index="${whitePly}" style="cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: background 0.2s ease, color 0.2s ease; ${wActiveStyle}">
          ${whiteMove ? whiteMove.san : ""}${whiteBadge}
        </span>
        <span class="move-clickable" data-index="${blackPly}" style="cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: background 0.2s ease, color 0.2s ease; ${bActiveStyle}">
          ${blackMove ? blackMove.san : ""}${blackBadge}
        </span>
      </div>
    `);
      }
      moveList.innerHTML = rows.join("");
    }
    moveList.addEventListener("click", (e) => {
      const target = e.target.closest(".move-clickable");
      if (!target || !state.snapshot) return;
      const index = parseInt(target.dataset.index, 10);
      if (index === state.snapshot.moves.length) {
        state.viewCursor = null;
      } else {
        state.viewCursor = index;
      }
      render();
    });
    function updateCaption() {
      const snapshot = state.snapshot;
      if (!snapshot || !state.role || state.role === "spectator") {
        boardCaption.textContent = snapshot ? `Spectating room ${snapshot.roomId}` : "";
        return;
      }
      const myColor = state.role;
      const opColor = myColor === "w" ? "b" : "w";
      const movesToReplay = state.viewCursor !== null ? snapshot.moves.slice(0, state.viewCursor) : snapshot.moves;
      const replayBoard = new Chess();
      const myCaptures = [];
      const opCaptures = [];
      for (const moveSummary of movesToReplay) {
        const moveResult = replayBoard.move(moveSummary.san);
        if (moveResult && moveResult.captured) {
          if (moveResult.color === myColor) {
            myCaptures.push(moveResult.captured);
          } else {
            opCaptures.push(moveResult.captured);
          }
        }
      }
      const sortOrder = { q: 1, r: 2, b: 3, n: 4, p: 5, k: 6 };
      myCaptures.sort((a, b) => sortOrder[a] - sortOrder[b]);
      opCaptures.sort((a, b) => sortOrder[a] - sortOrder[b]);
      let myCapturesHtml = "";
      myCaptures.forEach((piece) => {
        myCapturesHtml += `<img src="${PIECES[`${opColor}${piece}`]}" class="captured-icon" />`;
      });
      let opCapturesHtml = "";
      opCaptures.forEach((piece) => {
        opCapturesHtml += `<img src="${PIECES[`${myColor}${piece}`]}" class="captured-icon" />`;
      });
      const currentFen = replayBoard.fen();
      const rawValue = materialFromPerspective(currentFen, myColor);
      const netValue = Math.floor(rawValue / 100);
      if (!myCapturesHtml && !opCapturesHtml && netValue === 0) {
        boardCaption.innerHTML = `<span style="opacity: 0.6; font-weight: 500;">Material: Even</span>`;
      } else {
        boardCaption.innerHTML = `
      <div class="captures-wrapper">
        ${myCapturesHtml || netValue > 0 ? `
        <div class="captures-row">
          <div class="captures-icons">${myCapturesHtml}</div>
          ${netValue > 0 ? `<strong class="material-score plus">+${netValue}</strong>` : ""}
        </div>` : ""}
        
        ${opCapturesHtml || netValue < 0 ? `
        <div class="captures-row">
          <div class="captures-icons" style="opacity: 0.85;">${opCapturesHtml}</div>
          ${netValue < 0 ? `<strong class="material-score minus">${netValue}</strong>` : ""}
        </div>` : ""}
      </div>
    `;
      }
    }
    function materialFromPerspective(fen, color) {
      const board2 = fen.split(" ")[0] ?? "";
      let white = 0;
      let black = 0;
      for (const ch of board2) {
        if (ch === "/" || /\d/.test(ch)) {
          continue;
        }
        const value2 = PIECE_VALUES[ch.toLowerCase()] ?? 0;
        if (ch === ch.toUpperCase()) {
          white += value2;
        } else {
          black += value2;
        }
      }
      return color === "w" ? white - black : black - white;
    }
    function classifyLiveMoveQuality(input) {
      const {
        cpl,
        matchesBestMove,
        materialDelta,
        evalGain,
        isCapture,
        previousOpponentCategory
      } = input;
      const opponentBlundered = previousOpponentCategory === "mistake" || previousOpponentCategory === "blunder";
      const isSacrifice = materialDelta <= -100;
      const brilliantSacrifice = isSacrifice && evalGain >= 80 && cpl <= 35;
      const greatPunish = matchesBestMove && cpl <= 22 && opponentBlundered && (isCapture || materialDelta >= 100 || evalGain >= 110);
      if (brilliantSacrifice) {
        return { category: "brilliant", label: LIVE_CATEGORY_LABELS.brilliant };
      }
      if (greatPunish) {
        return { category: "great", label: LIVE_CATEGORY_LABELS.great };
      }
      if (cpl <= 45) {
        return { category: "excellent", label: LIVE_CATEGORY_LABELS.excellent };
      }
      if (cpl <= 90) {
        return { category: "good", label: LIVE_CATEGORY_LABELS.good };
      }
      if (cpl <= 160) {
        return { category: "inaccuracy", label: LIVE_CATEGORY_LABELS.inaccuracy };
      }
      if (cpl <= 280) {
        return { category: "mistake", label: LIVE_CATEGORY_LABELS.mistake };
      }
      return { category: "blunder", label: LIVE_CATEGORY_LABELS.blunder };
    }
    function symbolForLiveCategory(category) {
      if (category === "brilliant") return "!!";
      if (category === "great") return "!";
      if (category === "excellent") return "\u2605";
      if (category === "good") return "\u2713";
      if (category === "inaccuracy") return "?!";
      if (category === "mistake") return "x";
      return "??";
    }
    function summarizeLiveMove(label, cpl, san) {
      return `${label}: ${san} (${cpl} CPL)`;
    }
    function buildBeforeAfterFenFromMoves(moves) {
      if (moves.length === 0) {
        return null;
      }
      const replay = new Chess();
      for (let index = 0; index < moves.length - 1; index += 1) {
        replay.move(moves[index].san);
      }
      const beforeFen = replay.fen();
      replay.move(moves[moves.length - 1].san);
      const afterFen = replay.fen();
      return { beforeFen, afterFen };
    }
    async function maybeRunLiveAnalysis(snapshot) {
      const labelsOnlyMode = isLabelsOnlyMode(snapshot);
      if (isLiveAnalysisLocked(snapshot) && !labelsOnlyMode) {
        state.liveAnalysisSummary = "Live analysis disabled during active multiplayer games.";
        return;
      }
      if (!snapshot.analysis.enabled && !labelsOnlyMode || !snapshot.lastMove || snapshot.moves.length === 0) {
        return;
      }
      const moveKey = `${snapshot.moveCount}:${snapshot.lastMove.from}:${snapshot.lastMove.to}:${snapshot.lastMove.san}`;
      if (state.lastAnalyzedMoveKey === moveKey) {
        return;
      }
      const fenPair = buildBeforeAfterFenFromMoves(snapshot.moves);
      if (!fenPair) {
        return;
      }
      const token = ++liveAnalysisToken;
      state.liveAnalysisSummary = labelsOnlyMode ? "Classifying last move..." : "Analyzing last move...";
      renderSession();
      try {
        if (!liveAnalyzer) {
          liveAnalyzer = new StockfishBridge();
        }
        const [before, after] = await Promise.all([
          liveAnalyzer.evaluateFen(fenPair.beforeFen, 10),
          liveAnalyzer.evaluateFen(fenPair.afterFen, 10)
        ]);
        if (token !== liveAnalysisToken) {
          return;
        }
        if (!state.snapshot) {
          return;
        }
        const stillLabelsOnly = isLabelsOnlyMode(state.snapshot);
        if (!state.snapshot.analysis.enabled && !stillLabelsOnly) {
          return;
        }
        const moverBefore = before.cp;
        const moverAfter = -after.cp;
        const cpl = Math.max(0, Math.round(moverBefore - moverAfter));
        const playedUci = `${snapshot.lastMove.from}${snapshot.lastMove.to}`;
        const matchesBestMove = before.bestMove.startsWith(playedUci);
        const moverColor = fenPair.beforeFen.split(" ")[1] || "w";
        const materialBefore = materialFromPerspective(fenPair.beforeFen, moverColor);
        const materialAfter = materialFromPerspective(fenPair.afterFen, moverColor);
        const materialDelta = materialAfter - materialBefore;
        const evalGain = Math.round(moverAfter - moverBefore);
        const previousOpponentCategory = state.liveMoveGrades[snapshot.moveCount - 1]?.category;
        const quality = classifyLiveMoveQuality({
          cpl,
          matchesBestMove,
          materialDelta,
          evalGain,
          isCapture: snapshot.lastMove.san.includes("x"),
          previousOpponentCategory
        });
        const label = quality.label;
        const category = quality.category;
        state.liveAnalysisSummary = labelsOnlyMode ? `${label}: ${snapshot.lastMove.san}` : summarizeLiveMove(label, cpl, snapshot.lastMove.san);
        state.liveMoveGrades[snapshot.moveCount] = { label, cpl, category };
        state.lastAnalyzedMoveKey = moveKey;
      } catch {
        if (token !== liveAnalysisToken) {
          return;
        }
        state.liveAnalysisSummary = "Live analysis temporarily unavailable.";
      }
      render();
    }
    async function maybeRunLiveAnalysisForMove(previousMoves, move, _expectedMoveCount, _expectedMoveKey) {
      if (!liveAnalyzer) {
        try {
          liveAnalyzer = new StockfishBridge();
        } catch {
          return;
        }
      }
      try {
        const recreatedChess = new Chess();
        for (const m of previousMoves) {
          recreatedChess.move(m.san);
        }
        const beforeFen = recreatedChess.fen();
        const moveResult = recreatedChess.move(move);
        if (!moveResult) {
          return;
        }
        const afterFen = recreatedChess.fen();
        const [before, after] = await Promise.all([
          liveAnalyzer.evaluateFen(beforeFen, 10),
          liveAnalyzer.evaluateFen(afterFen, 10)
        ]);
        const moverBefore = before.cp;
        const moverAfter = -after.cp;
        const cpl = Math.max(0, Math.round(moverBefore - moverAfter));
        const playedUci = `${moveResult.from}${moveResult.to}`;
        const matchesBestMove = before.bestMove.startsWith(playedUci);
        const moverColor = beforeFen.split(" ")[1] || "w";
        const materialBefore = materialFromPerspective(beforeFen, moverColor);
        const materialAfter = materialFromPerspective(afterFen, moverColor);
        const materialDelta = materialAfter - materialBefore;
        const evalGain = Math.round(moverAfter - moverBefore);
        const previousOpponentCategory = state.liveMoveGrades[(state.snapshot?.moveCount ?? 0) - 1]?.category;
        const quality = classifyLiveMoveQuality({
          cpl,
          matchesBestMove,
          materialDelta,
          evalGain,
          isCapture: Boolean(moveResult.captured),
          previousOpponentCategory
        });
        const label = quality.label;
        state.liveAnalysisSummary = `You played: ${summarizeLiveMove(label, cpl, moveResult.san)}`;
        render();
      } catch (e) {
        console.error("Live analysis error:", e);
      }
    }
    function animateLastMove(lastMove) {
      if (!state.snapshot || !lastMove) {
        lastAnimatedMoveKey = null;
        return;
      }
      const moveKey = `${state.snapshot.moveCount}:${lastMove.from}:${lastMove.to}:${lastMove.san}`;
      if (lastAnimatedMoveKey === moveKey) return;
      if (state.premoves.length > 0 || suppressAnimationForMove) {
        lastAnimatedMoveKey = moveKey;
        suppressAnimationForMove = null;
        if (activeGhostAnimation) activeGhostAnimation.cancel();
        activeGhostAnimation = null;
        animationFinished = true;
        animatingToSquare = null;
        return;
      }
      lastAnimatedMoveKey = moveKey;
      animationFinished = false;
      animatingToSquare = lastMove.to;
      if (activeGhostAnimation) activeGhostAnimation.cancel();
      if (activeGhostNode) {
        activeGhostNode.remove();
        activeGhostNode = null;
      }
      if (activeGhostDestinationPiece) {
        activeGhostDestinationPiece.style.visibility = "";
        activeGhostDestinationPiece = null;
      }
      const fromSquareButton = board.querySelector(`[data-square="${lastMove.from}"]`);
      const toSquareButton = board.querySelector(`[data-square="${lastMove.to}"]`);
      const destinationPiece = toSquareButton?.querySelector(".piece");
      if (!fromSquareButton || !toSquareButton || !destinationPiece) {
        animationFinished = true;
        animatingToSquare = null;
        return;
      }
      const fromRect = fromSquareButton.getBoundingClientRect();
      const toRect = toSquareButton.getBoundingClientRect();
      const deltaX = fromRect.left + fromRect.width / 2 - (toRect.left + toRect.width / 2);
      const deltaY = fromRect.top + fromRect.height / 2 - (toRect.top + toRect.height / 2);
      const ghostPiece = destinationPiece.cloneNode(true);
      const pieceRect = destinationPiece.getBoundingClientRect();
      Object.assign(ghostPiece.style, {
        position: "absolute",
        left: `${toRect.left + toRect.width / 2 + window.scrollX}px`,
        top: `${toRect.top + toRect.height / 2 + window.scrollY}px`,
        width: `${pieceRect.width}px`,
        height: `${pieceRect.height}px`,
        transform: "translate3d(-50%, -50%, 0)",
        zIndex: "9999",
        pointerEvents: "none"
        // Notice: No filter here, so no blurry black shadows!
      });
      destinationPiece.style.visibility = "hidden";
      activeGhostNode = ghostPiece;
      activeGhostDestinationPiece = destinationPiece;
      document.body.append(ghostPiece);
      const animation = ghostPiece.animate(
        [
          { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0)` },
          { transform: "translate3d(-50%, -50%, 0)" }
        ],
        { duration: SMOOTH_MOVE_DURATION_MS, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" }
      );
      activeGhostAnimation = animation;
      let finalized = false;
      const onEnd = () => {
        if (finalized) return;
        finalized = true;
        ghostPiece.remove();
        destinationPiece.style.visibility = "";
        destinationPiece.style.opacity = "1";
        animationFinished = true;
        animatingToSquare = null;
        if (activeGhostAnimation === animation) {
          activeGhostAnimation = null;
          activeGhostNode = null;
          activeGhostDestinationPiece = null;
          if (pendingBoardRefresh) {
            pendingBoardRefresh = false;
            renderBoard();
          }
        }
      };
      animation.addEventListener("finish", onEnd);
      animation.addEventListener("cancel", onEnd);
    }
    function requestBoardRefresh(force = false) {
      if (force && activeGhostAnimation) {
        const tempAnim = activeGhostAnimation;
        activeGhostAnimation = null;
        if (activeGhostNode) {
          activeGhostNode.remove();
          activeGhostNode = null;
        }
        if (activeGhostDestinationPiece) {
          activeGhostDestinationPiece.style.visibility = "";
          activeGhostDestinationPiece.style.opacity = "1";
          activeGhostDestinationPiece = null;
        }
        animationFinished = true;
        animatingToSquare = null;
        tempAnim.cancel();
      }
      if (!force && activeGhostAnimation) {
        pendingBoardRefresh = true;
        return;
      }
      pendingBoardRefresh = false;
      renderBoard();
    }
    function animateLastMoveEpic(lastMove) {
      if (!state.snapshot || !lastMove) {
        lastAnimatedMoveKey = null;
        return;
      }
      const moveKey = `${state.snapshot.moveCount}:${lastMove.from}:${lastMove.to}:${lastMove.san}`;
      if (lastAnimatedMoveKey === moveKey) return;
      if (state.premoves.length > 0 || suppressAnimationForMove) {
        lastAnimatedMoveKey = moveKey;
        suppressAnimationForMove = null;
        if (activeGhostAnimation) activeGhostAnimation.cancel();
        activeGhostAnimation = null;
        animationFinished = true;
        animatingToSquare = null;
        return;
      }
      lastAnimatedMoveKey = moveKey;
      animationFinished = false;
      animatingToSquare = lastMove.to;
      if (activeGhostAnimation) activeGhostAnimation.cancel();
      if (activeGhostNode) {
        activeGhostNode.remove();
        activeGhostNode = null;
      }
      if (activeGhostDestinationPiece) {
        activeGhostDestinationPiece.style.visibility = "";
        activeGhostDestinationPiece = null;
      }
      const fromSquareButton = board.querySelector(`[data-square="${lastMove.from}"]`);
      const toSquareButton = board.querySelector(`[data-square="${lastMove.to}"]`);
      const destinationPiece = toSquareButton?.querySelector(".piece");
      if (!fromSquareButton || !toSquareButton || !destinationPiece) {
        animationFinished = true;
        animatingToSquare = null;
        return;
      }
      const fromRect = fromSquareButton.getBoundingClientRect();
      const toRect = toSquareButton.getBoundingClientRect();
      const startX = fromRect.left + fromRect.width / 2 + window.scrollX;
      const startY = fromRect.top + fromRect.height / 2 + window.scrollY;
      const endX = toRect.left + toRect.width / 2 + window.scrollX;
      const endY = toRect.top + toRect.height / 2 + window.scrollY;
      const deltaX = startX - endX;
      const deltaY = startY - endY;
      const pieceRect = destinationPiece.getBoundingClientRect();
      const ghostPiece = destinationPiece.cloneNode(true);
      Object.assign(ghostPiece.style, {
        position: "absolute",
        left: `${endX}px`,
        top: `${endY}px`,
        width: `${pieceRect.width}px`,
        height: `${pieceRect.height}px`,
        transform: "translate3d(-50%, -50%, 0)",
        zIndex: "9999",
        pointerEvents: "none"
      });
      destinationPiece.style.visibility = "hidden";
      activeGhostNode = ghostPiece;
      activeGhostDestinationPiece = destinationPiece;
      document.body.append(ghostPiece);
      const aura = state.trailFxEnabled ? "drop-shadow(0 0 12px rgba(255,255,255,0.3))" : "";
      const roll = Math.random();
      let profile = "slide";
      if (roll < 0.3) profile = "smash";
      else if (roll < 0.6) profile = "spin";
      let keyframes = [];
      let duration = EPIC_MOVE_DURATION_MS.spin;
      if (profile === "smash") {
        duration = EPIC_MOVE_DURATION_MS.smash;
        const jump = 90 + Math.random() * 40;
        const scale = 1.25 + Math.random() * 0.15;
        const spin = (Math.random() * 15 + 10) * (Math.random() > 0.5 ? 1 : -1);
        keyframes = [
          { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0) rotateZ(0deg) scale(1)`, filter: `brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0)) ${aura}`, offset: 0 },
          { transform: `translate3d(calc(-50% + ${deltaX * 0.15}px), calc(-50% + ${-jump}px), 0) rotateZ(${spin}deg) scale(${scale})`, filter: `brightness(1.4) drop-shadow(0 40px 25px rgba(0,0,0,0.45)) ${aura}`, offset: 0.65 },
          { transform: `translate3d(-50%, calc(-50% + 8px), 0) rotateZ(${-(spin * 0.5)}deg) scale(0.92)`, filter: `brightness(1.05) drop-shadow(0 2px 4px rgba(0,0,0,0.7)) ${aura}`, offset: 0.92 },
          { transform: "translate3d(-50%, -50%, 0) rotateZ(0deg) scale(1)", filter: `brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0)) ${aura}`, offset: 1 }
        ];
      } else if (profile === "spin") {
        duration = EPIC_MOVE_DURATION_MS.spin;
        const jump = 40 + Math.random() * 20;
        const spinDir = Math.random() > 0.5 ? 360 : -360;
        keyframes = [
          { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0) rotateZ(0deg)`, filter: `brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0)) ${aura}`, offset: 0 },
          { transform: `translate3d(calc(-50% + ${deltaX * 0.4}px), calc(-50% + ${-jump}px), 0) rotateZ(${spinDir * 0.6}deg)`, filter: `brightness(1.2) drop-shadow(0 15px 15px rgba(0,0,0,0.3)) ${aura}`, offset: 0.5 },
          { transform: `translate3d(-50%, -50%, 0) rotateZ(${spinDir}deg)`, filter: `brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0)) ${aura}`, offset: 1 }
        ];
      } else {
        duration = EPIC_MOVE_DURATION_MS.slide;
        const tilt = deltaX < 0 ? 18 : deltaX > 0 ? -18 : 0;
        keyframes = [
          { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0) rotateZ(0deg) scale(1)`, filter: `brightness(1) ${aura}`, offset: 0 },
          { transform: `translate3d(calc(-50% + ${deltaX * 0.4}px), calc(-50% + ${deltaY * 0.4 - 10}px), 0) rotateZ(${tilt}deg) scale(1.05)`, filter: `brightness(1.1) drop-shadow(0 8px 10px rgba(0,0,0,0.25)) ${aura}`, offset: 0.4 },
          { transform: `translate3d(-50%, calc(-50% + 4px), 0) rotateZ(${-(tilt * 0.3)}deg) scale(0.95)`, filter: `brightness(1) drop-shadow(0 2px 2px rgba(0,0,0,0.5)) ${aura}`, offset: 0.9 },
          { transform: "translate3d(-50%, -50%, 0) rotateZ(0deg) scale(1)", filter: `brightness(1) ${aura}`, offset: 1 }
        ];
      }
      const animation = ghostPiece.animate(keyframes, {
        duration,
        easing: profile === "slide" ? "cubic-bezier(0.1, 0.9, 0.2, 1)" : "cubic-bezier(0.22, 0.61, 0.36, 1)"
        // Slide gets a punchier easing
      });
      activeGhostAnimation = animation;
      startTrailSpawning();
      let finalized = false;
      const onEnd = () => {
        if (finalized) return;
        finalized = true;
        ghostPiece.remove();
        destinationPiece.style.visibility = "";
        destinationPiece.style.opacity = "1";
        animationFinished = true;
        animatingToSquare = null;
        if (activeGhostAnimation === animation) {
          activeGhostAnimation = null;
          activeGhostNode = null;
          activeGhostDestinationPiece = null;
          if (pendingBoardRefresh) {
            pendingBoardRefresh = false;
            renderBoard();
          }
        }
      };
      animation.addEventListener("finish", onEnd);
      animation.addEventListener("cancel", onEnd);
    }
    function onSquarePressed(square) {
      if (state.viewCursor !== null) {
        state.viewCursor = null;
        render();
        return;
      }
      const gameEnded = Boolean(state.snapshot && (state.snapshot.checkmate || state.snapshot.draw || state.snapshot.winner !== null));
      if (gameEnded) return;
      if (!state.snapshot || !state.role || state.role === "spectator") return;
      if (state.snapshot.turn !== state.role) {
        onPremoveSquarePressed(square);
        return;
      }
      if (square === state.selectedSquare) {
        clearSelection();
        requestBoardRefresh(true);
        updateCaption();
        return;
      }
      if (state.legalTargets.includes(square)) {
        const from = state.selectedSquare;
        clearSelection();
        requestBoardRefresh(true);
        if (from) {
          suppressAnimationForMove = null;
          tryMoveFromTo(from, square);
        }
        updateCaption();
        return;
      }
      const clickedPiece = chess.get(square);
      if (clickedPiece && isOwnPiece(clickedPiece.color)) {
        selectSquare(square);
        return;
      }
      if (state.selectedSquare) {
        clearSelection();
        requestBoardRefresh(true);
        updateCaption();
      }
    }
    function selectSquare(square) {
      state.selectedSquare = square;
      state.legalTargets = legalTargetsFor(square);
      requestBoardRefresh();
      updateCaption();
    }
    function clearSelection() {
      state.selectedSquare = null;
      state.legalTargets = [];
    }
    function legalTargetsFor(square) {
      return chess.moves({ square, verbose: true }).map((move) => move.to);
    }
    function legalTargetsForRole(square, role) {
      const fenParts = chess.fen().split(" ");
      fenParts[1] = role;
      const roleChess = new Chess(fenParts.join(" "));
      return roleChess.moves({ square, verbose: true }).map((move) => move.to);
    }
    function canStartMoveFrom(square) {
      if (state.viewCursor !== null) return false;
      if (!state.snapshot || !state.role || state.role === "spectator") return false;
      const vBoard = getVirtualBoard();
      const piece = vBoard.get(square);
      if (!piece || piece.color !== state.role) return false;
      return true;
    }
    function tryMoveFromTo(from, to) {
      const gameEnded = Boolean(state.snapshot && (state.snapshot.checkmate || state.snapshot.draw || state.snapshot.winner !== null));
      if (gameEnded) return;
      if (!state.snapshot || !state.role || state.role === "spectator") return;
      if (state.snapshot.turn !== state.role) {
        queuePremove(from, to);
        return;
      }
      const selectedPiece = chess.get(from);
      if (selectedPiece?.type === "p" && reachesPromotionRank(to, state.role)) {
        const isLegal = chess.moves({ verbose: true }).some((m) => m.from === from && m.to === to);
        if (!isLegal) return;
        state.pendingPromotion = { from, to };
        promotionDialog.hidden = false;
        return;
      }
      let playerMoveResult = null;
      if (state.gameMode === "multiplayer") {
        socket.emit("game:move", { from, to });
        const temp = new Chess(chess.fen());
        playerMoveResult = temp.move({ from, to, promotion: "q" });
      } else {
        playerMoveResult = chess.move({ from, to, promotion: "q" });
        if (!playerMoveResult) return;
        updateManualSnapshot(playerMoveResult);
        render(true);
        playSoundForSnapshot(state.snapshot);
        if (!state.snapshot.checkmate && !state.snapshot.draw) {
          setTimeout(() => triggerBotResponse(), 600);
        }
      }
      if (state.snapshot?.analysis.enabled && playerMoveResult) {
        state.liveAnalysisSummary = "Analyzing move...";
        renderSession();
        const moveKey = `${state.snapshot.moveCount}:${from}:${to}:${playerMoveResult.san}`;
        void maybeRunLiveAnalysisForMove(
          state.snapshot.moves.slice(0, -1),
          playerMoveResult,
          state.snapshot.moveCount,
          moveKey
        );
      }
    }
    function startBotGame() {
      state.gameMode = "bot";
      state.role = "w";
      state.roomId = "LOCAL_BOT";
      chess.reset();
      state.snapshot = {
        roomId: "LOCAL",
        ownerId: null,
        fen: chess.fen(),
        turn: chess.turn(),
        status: "Active",
        winner: null,
        check: false,
        checkmate: false,
        draw: false,
        moveCount: 0,
        moves: [],
        lastMove: null,
        players: { whiteConnected: true, blackConnected: true, spectatorCount: 0 },
        rematchVotes: 0,
        analysis: { enabled: false, votes: 0, locked: false, labelsOnly: false, labelsVotes: 0 },
        undo: { pending: false, requester: null },
        isStarted: true,
        pregame: { p1Choice: "w", p2Choice: "b", p1Ready: true, p2Ready: true },
        timeControl: {
          id: "blitz3",
          label: "3-minute Blitz",
          initialMs: 18e4,
          incrementMs: 0
        },
        clock: {
          whiteMs: 18e4,
          blackMs: 18e4,
          active: null,
          running: false,
          lowTimeThresholdMs: 2e4,
          serverNowMs: Date.now()
        }
      };
      showToast("Bot mode active. You are White!");
      render();
    }
    function updateManualSnapshot(move) {
      if (!state.snapshot) return;
      const countPieces = (f) => (f.split(" ")[0] || "").replace(/[^a-zA-Z]/g, "").length;
      const previousPieceCount = countPieces(state.snapshot.fen);
      const newSummary = {
        color: move.color,
        from: move.from,
        to: move.to,
        san: move.san,
        piece: move.piece
      };
      state.snapshot.fen = chess.fen();
      state.snapshot.turn = chess.turn();
      state.snapshot.moveCount++;
      state.snapshot.lastMove = newSummary;
      state.snapshot.moves.push(newSummary);
      clearArrows();
      const currentPieceCount = countPieces(state.snapshot.fen);
      if (state.bloodFxEnabled && currentPieceCount < previousPieceCount) {
        spawnBloodSplatter(move.to, move.captured || "p");
      }
      state.snapshot.check = chess.inCheck();
      state.snapshot.checkmate = chess.isCheckmate();
      state.snapshot.draw = chess.isDraw();
      if (state.snapshot.checkmate) {
        state.snapshot.winner = move.color;
      }
    }
    function isTheoreticallyPossible(from, to, piece, color) {
      const fromFile = from.charCodeAt(0) - 97;
      const fromRank = parseInt(from[1]);
      const toFile = to.charCodeAt(0) - 97;
      const toRank = parseInt(to[1]);
      const dx = Math.abs(toFile - fromFile);
      const dy = Math.abs(toRank - fromRank);
      if (dx === 0 && dy === 0) return false;
      switch (piece) {
        case "p":
          const forward = color === "w" ? toRank - fromRank : fromRank - toRank;
          const isStartRank = color === "w" && fromRank === 2 || color === "b" && fromRank === 7;
          if (dx === 0) return forward === 1 || isStartRank && forward === 2;
          if (dx === 1) return forward === 1;
          return false;
        case "n":
          return dx === 1 && dy === 2 || dx === 2 && dy === 1;
        case "b":
          return dx === dy;
        case "r":
          return dx === 0 || dy === 0;
        case "q":
          return dx === dy || dx === 0 || dy === 0;
        case "k":
          return dx <= 1 && dy <= 1 || dx === 2 && dy === 0;
        default:
          return false;
      }
    }
    function getVirtualBoard() {
      const vBoard = new Chess(chess.fen());
      for (const p of state.premoves) {
        const piece = vBoard.get(p.from);
        if (piece) {
          vBoard.remove(p.from);
          if (p.promotion) piece.type = p.promotion;
          vBoard.put(piece, p.to);
        }
      }
      const fenParts = vBoard.fen().split(" ");
      fenParts[1] = state.role;
      fenParts[3] = "-";
      vBoard.load(fenParts.join(" "));
      return vBoard;
    }
    function queuePremove(from, to) {
      if (!state.role || state.role === "spectator") return;
      const vBoard = getVirtualBoard();
      const piece = vBoard.get(from);
      if (!piece || piece.color !== state.role) return;
      if (!isTheoreticallyPossible(from, to, piece.type, piece.color)) return;
      const existingIndex = state.premoves.findIndex((p) => p.from === from && p.to === to);
      if (existingIndex !== -1) {
        state.premoves.splice(existingIndex, 1);
      } else {
        if (state.premoves.length >= 10) return;
        const promotion = piece.type === "p" && reachesPromotionRank(to, state.role) ? "q" : void 0;
        state.premoves.push(promotion ? { from, to, promotion } : { from, to });
      }
      clearSelection();
      requestBoardRefresh();
      updateCaption();
    }
    function onPremoveSquarePressed(square) {
      if (!state.role || state.role === "spectator") return;
      const vBoard = getVirtualBoard();
      const clickedPiece = vBoard.get(square);
      if (!state.selectedSquare) {
        if (clickedPiece && clickedPiece.color === state.role) {
          state.selectedSquare = square;
          state.legalTargets = vBoard.moves({ square, verbose: true }).map((m) => m.to);
          requestBoardRefresh(true);
          updateCaption();
        } else {
          if (state.premoves.length > 0) {
            state.premoves = [];
            requestBoardRefresh(true);
            updateCaption();
          }
        }
        return;
      }
      if (square === state.selectedSquare) {
        clearSelection();
        requestBoardRefresh(true);
        updateCaption();
        return;
      }
      const pieceToMove = vBoard.get(state.selectedSquare);
      if (pieceToMove && isTheoreticallyPossible(state.selectedSquare, square, pieceToMove.type, pieceToMove.color)) {
        queuePremove(state.selectedSquare, square);
      } else {
        state.premoves = [];
        clearSelection();
        requestBoardRefresh(true);
      }
      updateCaption();
    }
    function isOwnPiece(color) {
      return state.role === color;
    }
    function reachesPromotionRank(square, role) {
      return role === "w" ? square.endsWith("8") : square.endsWith("1");
    }
    function seatLabel(role) {
      if (state.role === role) {
        return `You (${role === "w" ? "White" : "Black"})`;
      }
      return `${role === "w" ? "White" : "Black"} player connected`;
    }
    function humanRole(role) {
      if (role === "w") {
        return "White";
      }
      if (role === "b") {
        return "Black";
      }
      if (role === "spectator") {
        return "Spectator";
      }
      return "Not seated";
    }
    function syncUrl(roomId) {
      const url2 = new URL(window.location.href);
      if (roomId) {
        url2.searchParams.set("room", roomId);
      } else {
        url2.searchParams.delete("room");
      }
      window.history.replaceState({}, "", url2);
    }
    function clearLocalRoomState() {
      if (activeGhostAnimation) {
        const animation = activeGhostAnimation;
        activeGhostAnimation = null;
        animation.cancel();
      }
      if (activeGhostNode) {
        activeGhostNode.remove();
        activeGhostNode = null;
      }
      if (activeGhostDestinationPiece) {
        activeGhostDestinationPiece.style.visibility = "";
        activeGhostDestinationPiece.style.opacity = "1";
        activeGhostDestinationPiece = null;
      }
      if (trailRafId !== null) {
        cancelAnimationFrame(trailRafId);
        trailRafId = null;
      }
      state.roomId = null;
      state.role = null;
      state.shareUrl = "";
      state.snapshot = null;
      state.pendingPromotion = null;
      state.premoves = [];
      state.selectedSquare = null;
      state.legalTargets = [];
      state.viewCursor = null;
      state.focusMode = false;
      state.gameMode = "multiplayer";
      state.liveAnalysisSummary = "Live analysis disabled.";
      state.lastAnalyzedMoveKey = null;
      state.liveMoveGrades = {};
      currentModalAction = null;
      suppressAnimationForMove = null;
      lastAnimatedMoveKey = null;
      pendingBoardRefresh = false;
      animationFinished = true;
      animatingToSquare = null;
      _lastPlayedMoveCount = -1;
      roomInput.value = "";
      for (const audio of Object.values(_audioCache)) {
        audio.pause();
        audio.currentTime = 0;
      }
      liveAnalysisToken += 1;
      lastRoomStateReceivedAtMs = Date.now();
      localStorage.removeItem("chess_roomId");
      cancelCurrentDrag();
      clearArrows();
      chess.reset();
      syncUrl(null);
    }
    function isTypingTarget(target) {
      const element = target;
      return Boolean(element?.closest("input, textarea, [contenteditable='true']"));
    }
    function shouldAutoScrollInviteJoin() {
      const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const isSmallViewport = window.matchMedia("(max-width: 1100px)").matches;
      return isCoarsePointer || isSmallViewport;
    }
    function isElementMostlyVisible(element, minVisibleRatio = 0.68) {
      const rect = element.getBoundingClientRect();
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
      const visibleArea = visibleWidth * visibleHeight;
      const totalArea = Math.max(1, rect.width * rect.height);
      return visibleArea / totalArea >= minVisibleRatio;
    }
    function scrollToInviteJoinCardOnMobile() {
      const needsForcedReveal = !isElementMostlyVisible(inviteJoinCard);
      if (!shouldAutoScrollInviteJoin() && !needsForcedReveal) {
        return;
      }
      window.requestAnimationFrame(() => {
        inviteJoinCard.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      });
    }
    function formatClockMs(ms) {
      const totalSeconds = Math.max(0, Math.ceil(ms / 1e3));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    function getDisplayClockMs(snapshot, color) {
      const baseMs = color === "w" ? snapshot.clock.whiteMs : snapshot.clock.blackMs;
      if (!snapshot.clock.running || snapshot.clock.active !== color) {
        return baseMs;
      }
      const elapsed = Math.max(0, Date.now() - lastRoomStateReceivedAtMs);
      return Math.max(0, baseMs - elapsed);
    }
    function getFocusTimerText() {
      const snapshot = state.snapshot;
      if (!snapshot) {
        return "W 00:00 | B 00:00";
      }
      const whiteText = formatClockMs(getDisplayClockMs(snapshot, "w"));
      const blackText = formatClockMs(getDisplayClockMs(snapshot, "b"));
      if (state.role === "w") {
        return `${whiteText} | Opp ${blackText}`;
      }
      if (state.role === "b") {
        return `${blackText} | Opp ${whiteText}`;
      }
      return `W ${whiteText} | B ${blackText}`;
    }
    function updateFocusHud() {
      if (!state.focusMode) {
        focusHud.hidden = true;
        focusMaterialHud.hidden = true;
        return;
      }
      focusTimer.textContent = getFocusTimerText();
      const snapshot = state.snapshot;
      if (snapshot && state.role && state.role !== "spectator") {
        const myColor = state.role;
        const opColor = myColor === "w" ? "b" : "w";
        const movesToReplay = state.viewCursor !== null ? snapshot.moves.slice(0, state.viewCursor) : snapshot.moves;
        const replayBoard = new Chess();
        const myCaptures = [];
        const opCaptures = [];
        for (const moveSummary of movesToReplay) {
          const moveResult = replayBoard.move(moveSummary.san);
          if (moveResult && moveResult.captured) {
            if (moveResult.color === myColor) {
              myCaptures.push(moveResult.captured);
            } else {
              opCaptures.push(moveResult.captured);
            }
          }
        }
        const sortOrder = { q: 1, r: 2, b: 3, n: 4, p: 5, k: 6 };
        myCaptures.sort((a, b) => sortOrder[a] - sortOrder[b]);
        opCaptures.sort((a, b) => sortOrder[a] - sortOrder[b]);
        let myCapturesHtml = "";
        myCaptures.forEach((piece) => {
          myCapturesHtml += `<img src="${PIECES[`${opColor}${piece}`]}" class="captured-icon" />`;
        });
        let opCapturesHtml = "";
        opCaptures.forEach((piece) => {
          opCapturesHtml += `<img src="${PIECES[`${myColor}${piece}`]}" class="captured-icon" />`;
        });
        const currentFen = replayBoard.fen();
        const rawValue = materialFromPerspective(currentFen, myColor);
        const netValue = Math.floor(rawValue / 100);
        if (myCapturesHtml || opCapturesHtml || netValue !== 0) {
          focusMaterialHud.innerHTML = `
        ${myCapturesHtml || netValue > 0 ? `
        <div class="focus-capture-row">
           <div class="focus-icons">${myCapturesHtml}</div>
           ${netValue > 0 ? `<span class="focus-score plus">+${netValue}</span>` : ""}
        </div>` : ""}
        
        ${opCapturesHtml || netValue < 0 ? `
        <div class="focus-capture-row">
           <div class="focus-icons" style="opacity: 0.85;">${opCapturesHtml}</div>
           ${netValue < 0 ? `<span class="focus-score minus">${netValue}</span>` : ""}
        </div>` : ""}
      `;
          focusMaterialHud.hidden = false;
        } else {
          focusMaterialHud.hidden = true;
        }
      } else {
        focusMaterialHud.hidden = true;
      }
      focusHud.hidden = false;
    }
    function applyFocusMode() {
      document.body.classList.toggle("focus-mode", state.focusMode);
      document.body.classList.toggle("focus-multiplayer", state.focusMode);
      focusModeButton.setAttribute("aria-pressed", String(state.focusMode));
      focusModeButton.textContent = state.focusMode ? "Exit" : "Focus";
      updateFocusHud();
    }
    async function toggleFocusMode(force) {
      const nextMode = force ?? !state.focusMode;
      if (nextMode === state.focusMode) {
        return;
      }
      state.focusMode = nextMode;
      applyFocusMode();
    }
    var toastTimer = 0;
    function showToast(message) {
      state.toastMessage = message;
      toast.textContent = message;
      toast.classList.add("visible");
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        toast.classList.remove("visible");
      }, 2200);
    }
    render();
    window.setInterval(updateFocusHud, 1e3);
    window.setInterval(() => {
      if (state.gameMode !== "multiplayer" || !state.snapshot || !state.snapshot.clock.running) {
        return;
      }
      renderSession();
    }, 250);
    window.addEventListener("beforeunload", () => {
      liveAnalyzer?.terminate();
    });
  }
});
export default require_main();
/*! Bundled license information:

chess.js/dist/esm/chess.js:
  (**
   * @license
   * Copyright (c) 2025, Jeff Hlywa (jhlywa@gmail.com)
   * All rights reserved.
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice,
   *    this list of conditions and the following disclaimer.
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   *    this list of conditions and the following disclaimer in the documentation
   *    and/or other materials provided with the distribution.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
   * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
   * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
   * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
   * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
   * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
   * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
   * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
   * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
   * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
   * POSSIBILITY OF SUCH DAMAGE.
   *)
*/
//# sourceMappingURL=main.js.map
