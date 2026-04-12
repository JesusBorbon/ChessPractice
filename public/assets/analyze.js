var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
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
function peg$SyntaxError(message, expected, found, location) {
  var self = Error.call(this, message);
  if (Object.setPrototypeOf) {
    Object.setPrototypeOf(self, peg$SyntaxError.prototype);
  }
  self.expected = expected;
  self.found = found;
  self.location = location;
  self.name = "SyntaxError";
  return self;
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
  function peg$classExpectation(parts, inverted, ignoreCase) {
    return { type: "class", parts, inverted, ignoreCase };
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
  function peg$buildStructuredError(expected, found, location) {
    return new peg$SyntaxError(
      peg$SyntaxError.buildMessage(expected, found),
      expected,
      found,
      location
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
        let empty = 0;
        let fen = "";
        for (let i = Ox88.a8; i <= Ox88.h1; i++) {
          if (this._board[i]) {
            if (empty > 0) {
              fen += empty;
              empty = 0;
            }
            const { color, type: piece } = this._board[i];
            fen += color === WHITE ? piece.toUpperCase() : piece.toLowerCase();
          } else {
            empty++;
          }
          if (i + 1 & 136) {
            if (empty > 0) {
              fen += empty;
            }
            if (i !== Ox88.h1) {
              fen += "/";
            }
            empty = 0;
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
      setHeader(key, value) {
        this._header[key] = value ?? SEVEN_TAG_ROSTER[key] ?? null;
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
        for (const [key, value] of Object.entries(this._header)) {
          if (value !== null) {
            nonNullHeaders[key] = value;
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

// src/client/analyze.css
var init_analyze = __esm({
  "src/client/analyze.css"() {
  }
});

// src/client/arrows.css
var init_arrows = __esm({
  "src/client/arrows.css"() {
  }
});

// src/client/badge-icon-colors.css
var init_badge_icon_colors = __esm({
  "src/client/badge-icon-colors.css"() {
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

// src/client/analyze.ts
var require_analyze = __commonJS({
  "src/client/analyze.ts"() {
    init_chess();
    init_engine();
    init_analyze();
    init_arrows();
    init_badge_icon_colors();
    init_arrow_render();
    init_best_move_arrow();
    init_theme();
    var CATEGORY_LABELS = {
      brilliant: "Brilliant",
      great: "Great",
      excellent: "Excellent",
      good: "Good",
      inaccuracy: "Inaccuracy",
      mistake: "Mistake",
      blunder: "Blunder"
    };
    var SUMMARY_CATEGORY_SYMBOLS = {
      excellent: "\u2605",
      great: "!",
      brilliant: "!!",
      blunder: "??"
    };
    var CATEGORY_TEXT_SYMBOLS = {
      brilliant: "!!",
      great: "!",
      excellent: "\u{1F44D}",
      good: "\u2713",
      inaccuracy: "?!",
      mistake: "x",
      blunder: "??"
    };
    var CATEGORY_BADGE_ICON_PATHS = {
      excellent: "/assets/labelBadges/excellent.svg",
      good: "/assets/labelBadges/good.svg",
      mistake: "/assets/labelBadges/mistake.svg"
    };
    var PIECE_VALUES = {
      p: 100,
      n: 320,
      b: 330,
      r: 500,
      q: 900,
      k: 0
    };
    var MATE_CP = 1e5;
    var BRILLIANT_VERIFICATION_DEPTH = 16;
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
          if (!this.ready) {
            this.initReject(new Error("No se pudo iniciar Stockfish."));
          }
          this.activeEval?.reject(new Error("Stockfish worker error."));
          this.activeEval = null;
        };
        this.send("uci");
        this.send("isready");
      }
      async evaluateFen(fen, depth) {
        await this.initPromise;
        const evalPromise = this.queue.then(() => {
          return new Promise((resolve, reject) => {
            this.activeEval = {
              resolve,
              reject,
              lastCp: 0,
              mate: null,
              pv: "",
              bestMove: ""
            };
            this.send(`position fen ${fen}`);
            this.send(`go depth ${depth}`);
          });
        });
        this.queue = evalPromise.then(() => void 0).catch(() => void 0);
        return evalPromise;
      }
      terminate() {
        this.worker.terminate();
      }
      onMessage(line) {
        if (!line) return;
        if (line === "readyok" && !this.ready) {
          this.ready = true;
          this.initResolve();
          return;
        }
        if (!this.activeEval) {
          return;
        }
        if (line.startsWith("info ")) {
          const parsed = parseInfoLine(line);
          if (parsed) {
            this.activeEval.lastCp = parsed.cp;
            this.activeEval.mate = parsed.mate;
            this.activeEval.pv = parsed.pv;
          }
          return;
        }
        if (line.startsWith("bestmove ")) {
          const bestMove = line.split(" ")[1] ?? "";
          this.activeEval.bestMove = bestMove;
          this.activeEval.resolve({
            cp: this.activeEval.lastCp,
            mate: this.activeEval.mate,
            bestMove: this.activeEval.bestMove,
            pv: this.activeEval.pv
          });
          this.activeEval = null;
        }
      }
      send(command) {
        this.worker.postMessage(command);
      }
    };
    function parseInfoLine(line) {
      const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
      if (!scoreMatch) {
        return null;
      }
      const kind = scoreMatch[1];
      const value = Number(scoreMatch[2]);
      const pvMatch = line.match(/\spv\s(.+)$/);
      const pv = pvMatch?.[1]?.trim() ?? "";
      if (kind === "mate") {
        const cp = value > 0 ? MATE_CP - Math.min(Math.abs(value), 99) * 100 : -MATE_CP + Math.min(Math.abs(value), 99) * 100;
        return { cp, mate: value, pv };
      }
      return { cp: value, mate: null, pv };
    }
    function appendCategoryMarkerContent(marker, category) {
      const iconPath = CATEGORY_BADGE_ICON_PATHS[category];
      if (iconPath) {
        const icon = document.createElement("img");
        icon.className = "piece-quality-marker-icon";
        icon.src = iconPath;
        icon.alt = `${CATEGORY_LABELS[category]} move`;
        icon.draggable = false;
        marker.append(icon);
        return;
      }
      marker.textContent = CATEGORY_TEXT_SYMBOLS[category];
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
    var orientation = "w";
    var selectedSquare = null;
    var legalTargets = [];
    var pendingPromotion = null;
    var suppressClickSquare = null;
    var suppressClickUntil = 0;
    var fenHistory = [chess.fen()];
    var moveHistory = [];
    var cursor = 0;
    var arrowAnnotations = /* @__PURE__ */ new Set();
    var squareAnnotations = /* @__PURE__ */ new Set();
    var lastAnimatedMoveKey = null;
    var suppressAnimationForMove = null;
    var activeGhostAnimation = null;
    var activeGhostNode = null;
    var activeGhostDestinationPiece = null;
    var pendingBoardRefresh = false;
    var stockfish = null;
    var analysisDepth = 12;
    var analysisByPly = [];
    var analysisRunId = 0;
    var analysisInProgress = false;
    var fullAnalysisInProgress = false;
    var bestMovesEnabled = localStorage.getItem("chess-analyze-best-moves") !== "off";
    var liveBestMoveArrow = null;
    var liveBestMoveArrowFen = null;
    var liveBestMoveRequestFen = null;
    var bestMoveArrowToken = 0;
    var gameLineFenHistory = [...fenHistory];
    var gameLineMoveHistory = [...moveHistory];
    var gameLineAnalysisByPly = [];
    var gameLineLocked = false;
    var isVariationMode = false;
    var variationBranchPly = null;
    var variationReturnCursor = 0;
    var analysisProgressCompleted = 0;
    var analysisProgressTotal = 0;
    var lastQualityCalloutCursor = -1;
    var activeQualityCallout = null;
    var analysisSummaryAcknowledged = false;
    var focusMode = false;
    var legalMovesEnabled = localStorage.getItem("chess-legal-moves") !== "off";
    var animationStyle = localStorage.getItem("chess-animation-style") || "smooth";
    var bloodFxEnabled = localStorage.getItem("chess-blood-fx") === "on";
    var lastCheckFlashKey = null;
    var SMOOTH_MOVE_DURATION_MS = 620;
    var EPIC_MOVE_DURATION_MS = {
      smash: 860,
      spin: 760,
      slide: 620
    };
    var POST_GAME_MOVES_STORAGE_KEY = "postGameMoves";
    var POST_GAME_PGN_STORAGE_KEY = "postGamePgn";
    var POST_GAME_META_STORAGE_KEY = "postGameMeta";
    var analyzedWhiteName = "White";
    var analyzedBlackName = "Black";
    var app = document.querySelector("#app");
    app.innerHTML = `
<div class="analyze-shell">
  <div class="analyze-topbar">
    <a href="/">\u2190 Back to multiplayer</a>
    <h1>Analysis Board</h1>
  </div>

  <div class="analyze-layout">
    <section class="panel analyze-board-panel">
      <div class="analyze-toolbar">
        <button class="btn-primary" id="resetBtn">Reset board</button>
        <button class="btn-ghost"   id="flipBtn">Flip board</button>
        <button class="btn-ghost"   id="copyFenBtn">Copy FEN</button>
        <button class="btn-ghost"   id="loadFenBtn">Load FEN</button>
        <button class="btn-ghost"   id="bestMovesToggleBtn">Best Moves: On</button>
        <button class="btn-primary" id="returnGameLineBtn" disabled>Return to Game Line</button>
        <button class="btn-primary" id="analyzeBtn">Analyze game</button>
        <button class="btn-ghost"   id="stopAnalyzeBtn">Stop</button>
      </div>

      <div class="board-wrap">
        <div class="board" id="board"></div>
        <svg class="analyze-arrows" id="arrowLayer" viewBox="0 0 800 800" aria-hidden="true"></svg>
      </div>

      <div class="nav-row">
        <button id="navFirst" title="Go to start">\u23EE</button>
        <button id="navPrev"  title="Previous move">\u25C0</button>
        <button id="navNext"  title="Next move">\u25B6</button>
        <button id="navLast"  title="Go to end">\u23ED</button>
      </div>

      <div class="analyze-status" id="statusBar">White to move.</div>
      <button class="focus-toggle-btn" id="focusModeBtn" type="button" aria-pressed="false">Focus</button>
    </section>

    <aside class="analyze-side">
      <div class="info-card turn-card">
        <h2>Turn</h2>
        <div class="turn-indicator">
          <div class="turn-dot" id="turnDot"></div>
          <span id="turnLabel">White</span>
        </div>
      </div>

      <div class="info-card fen-card">
        <h2>FEN</h2>
        <textarea class="fen-input" id="fenDisplay" rows="3" readonly></textarea>
      </div>

      <div class="info-card moves-card">
        <h2>Moves</h2>
        <div class="analyze-move-list" id="moveList"></div>
      </div>

      <div class="info-card feedback-card">
        <h2>Engine feedback</h2>
        <div class="engine-feedback" id="engineFeedback">Run analysis to get move quality feedback.</div>
      </div>
    </aside>
  </div>
</div>

<div class="promotion-dialog" id="promoDialog" hidden>
  <div class="promotion-card">
    <h2 class="card-title">Promote pawn to\u2026</h2>
    <div class="promotion-grid">
      <button class="promotion-button" data-p="q">\u265B Queen</button>
      <button class="promotion-button" data-p="r">\u265C Rook</button>
      <button class="promotion-button" data-p="b">\u265D Bishop</button>
      <button class="promotion-button" data-p="n">\u265E Knight</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<div class="analysis-loading-overlay" id="analysisLoadingOverlay" hidden>
  <div class="analysis-loading-card" role="status" aria-live="polite" aria-atomic="true">
    <h2>Analyzing game...</h2>
    <p class="analysis-loading-status" id="analysisLoadingStatus">0 / 0 moves analyzed</p>
    <div class="analysis-loading-track" aria-hidden="true">
      <div class="analysis-loading-fill" id="analysisLoadingFill"></div>
    </div>
    <p class="analysis-loading-note">Navigation is disabled until analysis is complete.</p>
  </div>
</div>

<div class="analysis-summary-overlay" id="analysisSummaryOverlay" hidden>
  <div class="analysis-summary-card" role="dialog" aria-modal="true" aria-labelledby="analysisSummaryTitle">
    <h2 id="analysisSummaryTitle">Review Snapshot</h2>
    <p class="analysis-summary-subtitle">Combined totals. Tap anywhere to continue.</p>
    <div class="analysis-summary-counts" id="analysisSummaryCounts"></div>
    <button class="btn-primary analysis-summary-continue" id="analysisSummaryContinue" type="button">Continue</button>
  </div>
</div>
`;
    mountThemeSwitcher();
    window.addEventListener("animationchange", (event) => {
      const customEvent = event;
      animationStyle = customEvent.detail.style;
    });
    window.addEventListener("bloodfxchange", (event) => {
      const customEvent = event;
      bloodFxEnabled = customEvent.detail.enabled;
    });
    window.addEventListener("legalmoveschange", (event) => {
      const customEvent = event;
      legalMovesEnabled = customEvent.detail.enabled;
      renderBoard();
    });
    var arrowLayer = q("#arrowLayer");
    var boardEl = q("#board");
    var boardWrap = q(".board-wrap");
    var statusBar = q("#statusBar");
    var fenDisplay = q("#fenDisplay");
    var moveList = q("#moveList");
    var engineFeedback = q("#engineFeedback");
    var turnDot = q("#turnDot");
    var turnLabel = q("#turnLabel");
    var promoDialog = q("#promoDialog");
    var toast = q("#toast");
    var analysisLoadingOverlay = q("#analysisLoadingOverlay");
    var analysisLoadingStatus = q("#analysisLoadingStatus");
    var analysisLoadingFill = q("#analysisLoadingFill");
    var analysisSummaryOverlay = q("#analysisSummaryOverlay");
    var analysisSummaryCounts = q("#analysisSummaryCounts");
    var analysisSummaryContinue = q("#analysisSummaryContinue");
    var navFirst = q("#navFirst");
    var navPrev = q("#navPrev");
    var navNext = q("#navNext");
    var navLast = q("#navLast");
    var analyzeBtn = q("#analyzeBtn");
    var stopAnalyzeBtn = q("#stopAnalyzeBtn");
    var bestMovesToggleButton = q("#bestMovesToggleBtn");
    var returnGameLineButton = q("#returnGameLineBtn");
    var focusModeButton = q("#focusModeBtn");
    analysisLoadingOverlay.addEventListener("wheel", (event) => {
      event.preventDefault();
    }, { passive: false });
    analysisLoadingOverlay.addEventListener("touchmove", (event) => {
      event.preventDefault();
    }, { passive: false });
    analysisSummaryOverlay.addEventListener("click", () => {
      hideAnalysisSummaryOverlay(true);
    });
    analysisSummaryContinue.addEventListener("click", (event) => {
      event.preventDefault();
      hideAnalysisSummaryOverlay(true);
    });
    function resetBoardStateToStart() {
      cancelAnalysis();
      hideAnalysisSummaryOverlay();
      chess.reset();
      fenHistory = [chess.fen()];
      moveHistory = [];
      cursor = 0;
      analysisByPly = [];
      clearVariationMode();
      gameLineLocked = false;
      syncGameLineFromCurrent();
      clearSelection();
    }
    q("#resetBtn").addEventListener("click", () => {
      resetBoardStateToStart();
      render();
    });
    q("#flipBtn").addEventListener("click", () => {
      orientation = orientation === "w" ? "b" : "w";
      renderBoard();
      renderArrows();
    });
    q("#copyFenBtn").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(chess.fen());
        showToast("FEN copied.");
      } catch {
        showToast("Copy failed \u2014 select the FEN text manually.");
      }
    });
    q("#loadFenBtn").addEventListener("click", () => {
      const raw = prompt("Paste a FEN string:");
      if (!raw) return;
      try {
        resetBoardStateToStart();
        chess.load(raw.trim());
        fenHistory = [chess.fen()];
        moveHistory = [];
        cursor = 0;
        analysisByPly = [];
        clearVariationMode();
        syncGameLineFromCurrent();
        clearSelection();
        render();
        showToast("Position loaded.");
      } catch {
        showToast("Invalid FEN \u2014 position was not changed.");
      }
    });
    bestMovesToggleButton.addEventListener("click", () => {
      bestMovesEnabled = !bestMovesEnabled;
      localStorage.setItem("chess-analyze-best-moves", bestMovesEnabled ? "on" : "off");
      if (!bestMovesEnabled) {
        clearLiveBestMoveArrow();
      }
      updateBestMovesToggleButton();
      void maybeUpdateLiveBestMoveArrow(true);
      renderArrows();
    });
    returnGameLineButton.addEventListener("click", () => {
      returnToGameLine();
    });
    analyzeBtn.addEventListener("click", () => {
      void runGameAnalysis();
    });
    stopAnalyzeBtn.addEventListener("click", () => {
      if (!fullAnalysisInProgress) return;
      cancelAnalysis();
      showToast("Analysis stopped.");
      renderSide();
    });
    focusModeButton.addEventListener("click", () => {
      void toggleFocusMode();
    });
    window.addEventListener("keydown", (event) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === "ArrowLeft") {
        if (fullAnalysisInProgress) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        goTo(cursor - 1);
      } else if (event.key === "ArrowRight") {
        if (fullAnalysisInProgress) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        goTo(cursor + 1);
      } else if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        void toggleFocusMode();
      }
    });
    navFirst.addEventListener("click", () => goTo(0));
    navPrev.addEventListener("click", () => goTo(cursor - 1));
    navNext.addEventListener("click", () => goTo(cursor + 1));
    navLast.addEventListener("click", () => goTo(fenHistory.length - 1));
    function goTo(index) {
      if (fullAnalysisInProgress) {
        return;
      }
      const previousCursor = cursor;
      const clamped = Math.max(0, Math.min(fenHistory.length - 1, index));
      if (clamped === cursor) return;
      cursor = clamped;
      chess.load(fenHistory[cursor]);
      const traversedMove = cursor > previousCursor ? moveHistory[cursor - 1] : moveHistory[previousCursor - 1];
      if (chess.isCheckmate() || chess.isStalemate() || chess.isDraw()) {
        playSound("gameEndOrCheckmate");
      } else {
        let specialSoundPlayed = false;
        if (chess.isCheck()) {
          playSound("checkMove");
          specialSoundPlayed = true;
        }
        if (traversedMove?.captured) {
          playSound("capture");
          specialSoundPlayed = true;
        }
        if ((traversedMove?.flags.includes("k") || traversedMove?.flags.includes("q")) && !specialSoundPlayed) {
          playSound("castle");
          specialSoundPlayed = true;
        }
        if (!specialSoundPlayed) {
          playSound("move-self");
        }
      }
      clearSelection();
      render();
    }
    boardEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".square");
      const sq = btn?.dataset.square;
      if (sq && suppressClickSquare === sq && performance.now() <= suppressClickUntil) {
        suppressClickSquare = null;
        suppressClickUntil = 0;
        return;
      }
      suppressClickSquare = null;
      suppressClickUntil = 0;
      if (sq) {
        clearArrows();
        onSquareClick(sq);
      }
    });
    boardEl.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
    var ptrDragFrom = null;
    var ptrDragNode = null;
    var ptrDragMoved = false;
    var ptrStartX = 0;
    var ptrStartY = 0;
    var arrowDragFrom = null;
    var arrowDragTo = null;
    var arrowDragPointer = null;
    var arrowDragMoved = false;
    boardEl.addEventListener("pointerdown", (event) => {
      if (event.button === 0 && (arrowAnnotations.size > 0 || squareAnnotations.size > 0)) {
        clearArrows();
      }
      if (event.button === 2) {
        const square2 = getSquareFromPoint(event.clientX, event.clientY);
        if (!square2) return;
        arrowDragFrom = square2;
        arrowDragTo = null;
        arrowDragPointer = squareCenter(square2);
        arrowDragMoved = false;
        ptrStartX = event.clientX;
        ptrStartY = event.clientY;
        boardEl.setPointerCapture(event.pointerId);
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
      boardEl.setPointerCapture(event.pointerId);
    });
    boardEl.addEventListener("pointermove", (event) => {
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
        selectedSquare = ptrDragFrom;
        legalTargets = chess.moves({ square: ptrDragFrom, verbose: true }).map((m) => m.to);
        syncBoardInteractionState();
        const btn = boardEl.querySelector(`[data-square="${ptrDragFrom}"]`);
        const piece = btn?.querySelector(".piece");
        if (piece && btn) {
          const pieceRect = piece.getBoundingClientRect();
          ptrDragNode = piece.cloneNode(true);
          Object.assign(ptrDragNode.style, {
            position: "fixed",
            pointerEvents: "none",
            zIndex: "9999",
            width: `${pieceRect.width}px`,
            height: `${pieceRect.height}px`,
            margin: "0",
            lineHeight: "1",
            transformOrigin: "center center",
            transition: "none"
          });
          document.body.append(ptrDragNode);
          btn.classList.add("dragging");
        }
      }
      if (ptrDragNode) {
        ptrDragNode.style.left = `${event.clientX - ptrDragNode.offsetWidth / 2}px`;
        ptrDragNode.style.top = `${event.clientY - ptrDragNode.offsetHeight / 2}px`;
      }
    });
    function endPointerDrag(event, commit) {
      if (!ptrDragFrom) return;
      const fromSquare = ptrDragFrom;
      const wasDrag = ptrDragMoved;
      ptrDragFrom = null;
      ptrDragMoved = false;
      ptrDragNode?.remove();
      ptrDragNode = null;
      boardEl.querySelector(".square.dragging")?.classList.remove("dragging");
      if (!commit) return;
      const el = document.elementFromPoint(event.clientX, event.clientY);
      const squareButton = el?.closest(".square");
      const targetSquare = squareButton?.dataset.square;
      if (!wasDrag) {
        if (!targetSquare) return;
        suppressClickSquare = targetSquare;
        suppressClickUntil = performance.now() + 250;
        clearArrows();
        onSquareClick(targetSquare);
        return;
      }
      if (targetSquare) {
        suppressClickSquare = targetSquare;
        suppressClickUntil = performance.now() + 250;
        suppressAnimationForMove = { from: fromSquare, to: targetSquare };
        onSquareClick(targetSquare);
      }
      clearSelection();
      renderBoard();
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
        renderBoard();
        return;
      }
      toggleArrow(fromSquare, targetSquare);
      arrowDragMoved = false;
      renderArrows();
    }
    boardEl.addEventListener("pointerup", (event) => {
      if (event.button === 2 || arrowDragFrom) {
        endArrowDrag(event, true);
        return;
      }
      endPointerDrag(event, true);
    });
    boardEl.addEventListener("pointercancel", (event) => {
      endArrowDrag(event, false);
      endPointerDrag(event, false);
    });
    promoDialog.addEventListener("click", (e) => {
      const clickedElement = e.target;
      const clickedInsideCard = Boolean(clickedElement.closest(".promotion-card"));
      if (!clickedInsideCard) {
        pendingPromotion = null;
        promoDialog.hidden = true;
        clearSelection();
        renderBoard();
        return;
      }
      const btn = e.target.closest("[data-p]");
      if (!btn || !pendingPromotion) return;
      commitMove(pendingPromotion.from, pendingPromotion.to, btn.dataset.p);
      pendingPromotion = null;
      promoDialog.hidden = true;
    });
    moveList.addEventListener("click", (e) => {
      if (fullAnalysisInProgress) {
        return;
      }
      const span = e.target.closest("span[data-idx]");
      if (!span) return;
      const idx = Number(span.dataset.idx);
      goTo(idx);
    });
    function onSquareClick(square) {
      if (chess.isGameOver()) return;
      const piece = chess.get(square);
      if (!selectedSquare) {
        if (piece && piece.color === chess.turn()) {
          selectSquare(square);
        }
        return;
      }
      if (square === selectedSquare) {
        clearSelection();
        renderBoard();
        return;
      }
      if (legalTargets.includes(square)) {
        tryMoveFromTo(selectedSquare, square);
        return;
      }
      if (piece && piece.color === chess.turn()) {
        selectSquare(square);
        return;
      }
      clearSelection();
      renderBoard();
    }
    function commitMove(from, to, promotion) {
      cancelAnalysis();
      const move = chess.move({ from, to, promotion });
      if (!move) return;
      const shouldBranchFromEarlierMove = cursor < fenHistory.length - 1;
      const shouldBranchPastGameEnd = gameLineLocked && !isVariationMode && cursor >= gameLineFenHistory.length - 1;
      if (shouldBranchFromEarlierMove || shouldBranchPastGameEnd) {
        const branchPly = shouldBranchFromEarlierMove ? cursor : Math.max(0, gameLineFenHistory.length - 2);
        enterVariationMode(branchPly);
      }
      fenHistory = fenHistory.slice(0, cursor + 1);
      moveHistory = moveHistory.slice(0, cursor);
      moveHistory.push(move);
      fenHistory.push(chess.fen());
      analysisByPly = analysisByPly.slice(0, moveHistory.length);
      cursor = fenHistory.length - 1;
      if (!isVariationMode) {
        syncGameLineFromCurrent();
      }
      clearArrows();
      clearSelection();
      if (chess.isCheckmate() || chess.isStalemate() || chess.isDraw()) {
        playSound("gameEndOrCheckmate");
      } else if (chess.isCheck()) {
        playSound("checkMove");
        lastCheckFlashKey = `${cursor}:${chess.fen()}`;
        triggerCheckFlash();
        if (move.captured) {
          playSound("capture");
        }
      } else if (move.flags.includes("k") || move.flags.includes("q")) {
        playSound("castle");
      } else if (move.captured) {
        playSound("capture");
      } else {
        playSound("move-self");
      }
      if (bloodFxEnabled && move.captured) {
        spawnBloodSplatter(to, move.captured);
      }
      render();
      void analyzeLatestMove();
    }
    function tryMoveFromTo(from, to) {
      const movingPiece = chess.get(from);
      if (movingPiece?.type === "p" && isPromotionRank(to, chess.turn())) {
        pendingPromotion = { from, to };
        promoDialog.hidden = false;
        return;
      }
      commitMove(from, to, "q");
    }
    function canStartMoveFrom(square) {
      if (chess.isGameOver()) {
        return false;
      }
      const piece = chess.get(square);
      return Boolean(piece && piece.color === chess.turn());
    }
    function selectSquare(square) {
      selectedSquare = square;
      legalTargets = chess.moves({ square, verbose: true }).map((m) => m.to);
      renderBoard();
    }
    function clearSelection() {
      selectedSquare = null;
      legalTargets = [];
    }
    function isPromotionRank(square, color) {
      return color === "w" ? square[1] === "8" : square[1] === "1";
    }
    function render() {
      renderBoard();
      renderStatus();
      renderSide();
      renderNav();
      updateBestMovesToggleButton();
      updateVariationToolbar();
      void maybeUpdateLiveBestMoveArrow();
    }
    function isTypingTarget(target) {
      const element = target;
      return Boolean(element?.closest("input, textarea, [contenteditable='true']"));
    }
    function applyFocusMode() {
      document.body.classList.toggle("focus-mode", focusMode);
      document.body.classList.toggle("focus-analyze", focusMode);
      focusModeButton.setAttribute("aria-pressed", String(focusMode));
      focusModeButton.textContent = focusMode ? "Exit" : "Focus";
    }
    async function toggleFocusMode(force) {
      const nextMode = force ?? !focusMode;
      if (nextMode === focusMode) {
        return;
      }
      focusMode = nextMode;
      applyFocusMode();
    }
    function renderBoard() {
      const squares = buildSquareList(orientation);
      const lastMove = getLastMove();
      const selectedMoveEval = cursor > 0 ? analysisByPly[cursor] : void 0;
      const selectedMoveTo = moveHistory[cursor - 1]?.to;
      const lastMoveSquares = new Set([lastMove?.from, lastMove?.to].filter(Boolean));
      const checkedKingSquare = getCheckedKingSquare();
      const fragment = document.createDocumentFragment();
      for (const squareName of squares) {
        const sq = squareName;
        const piece = chess.get(sq);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.tabIndex = -1;
        btn.className = `square ${isLightSquare(squareName) ? "light" : "dark"}`;
        btn.dataset.square = sq;
        btn.setAttribute("aria-label", sq);
        if (selectedSquare === sq) btn.classList.add("selected");
        if (legalMovesEnabled && legalTargets.includes(sq)) btn.classList.add("legal");
        if (lastMoveSquares.has(sq)) btn.classList.add("last-move");
        if (checkedKingSquare === sq) btn.classList.add("in-check");
        if (squareAnnotations.has(sq)) btn.classList.add("highlight-red");
        if (selectedMoveEval?.category === "great" && selectedMoveTo === sq) btn.classList.add("great-move-highlight");
        if (selectedMoveEval?.category === "brilliant" && selectedMoveTo === sq) btn.classList.add("brilliant-move-highlight");
        if (piece) {
          const span = document.createElement("span");
          span.className = `piece piece-${piece.type} ${piece.color === "w" ? "white" : "black"}`;
          const pieceImage = document.createElement("img");
          pieceImage.className = "piece-image";
          pieceImage.src = PIECES[`${piece.color}${piece.type}`] ?? "";
          pieceImage.alt = `${piece.color === "w" ? "White" : "Black"} ${piece.type}`;
          pieceImage.draggable = false;
          span.append(pieceImage);
          btn.append(span);
          if (selectedMoveEval && selectedMoveTo === sq) {
            const marker = document.createElement("span");
            marker.className = `piece-quality-marker ${selectedMoveEval.category}`;
            appendCategoryMarkerContent(marker, selectedMoveEval.category);
            marker.title = `${selectedMoveEval.label} (${selectedMoveEval.cpl} CPL)`;
            btn.append(marker);
          }
        }
        fragment.append(btn);
      }
      boardEl.replaceChildren(fragment);
      if (animationStyle === "epic") {
        animateLastMoveEpic(lastMove);
      } else {
        animateLastMove(lastMove);
      }
      if (selectedMoveEval && selectedMoveTo && (selectedMoveEval.category === "great" || selectedMoveEval.category === "brilliant") && lastQualityCalloutCursor !== cursor) {
        lastQualityCalloutCursor = cursor;
        showQualityMoveCallout(selectedMoveEval.category, selectedMoveTo);
      }
      renderArrows();
    }
    function showQualityMoveCallout(category, square) {
      activeQualityCallout?.remove();
      activeQualityCallout = null;
      const center = squareCenter(square);
      const label = category === "great" ? "Great Move" : "Brilliant Move";
      const callout = document.createElement("div");
      callout.className = `move-quality-callout move-quality-callout--${category}`;
      callout.textContent = label;
      callout.style.left = `${center.x / 800 * 100}%`;
      callout.style.top = `${center.y / 800 * 100}%`;
      boardWrap.append(callout);
      activeQualityCallout = callout;
      const clearCallout = () => {
        if (activeQualityCallout === callout) {
          activeQualityCallout = null;
        }
        callout.remove();
      };
      callout.addEventListener("animationend", clearCallout, { once: true });
      window.setTimeout(clearCallout, 2e3);
    }
    function syncBoardInteractionState() {
      for (const squareButton of boardEl.querySelectorAll(".square")) {
        const square = squareButton.dataset.square;
        if (!square) {
          continue;
        }
        squareButton.classList.toggle("selected", selectedSquare === square);
        squareButton.classList.toggle("legal", legalTargets.includes(square));
      }
    }
    function renderStatus() {
      let text;
      statusBar.className = "analyze-status";
      if (chess.isCheckmate()) {
        const winner = chess.turn() === "w" ? "Black" : "White";
        text = `Checkmate \u2014 ${winner} wins!`;
        statusBar.classList.add("gameover");
      } else if (chess.isStalemate()) {
        text = "Stalemate \u2014 draw.";
        statusBar.classList.add("gameover");
      } else if (chess.isDraw()) {
        text = "Draw.";
        statusBar.classList.add("gameover");
      } else if (chess.isCheck()) {
        text = `${chess.turn() === "w" ? "White" : "Black"} is in check!`;
        statusBar.classList.add("check");
        const checkKey = `${cursor}:${chess.fen()}`;
        if (lastCheckFlashKey !== checkKey) {
          lastCheckFlashKey = checkKey;
          triggerCheckFlash();
        }
      } else {
        text = `${chess.turn() === "w" ? "White" : "Black"} to move.`;
        lastCheckFlashKey = null;
      }
      const withMoveCursor = cursor < fenHistory.length - 1 ? `[Move ${cursor} of ${fenHistory.length - 1}] ${text}` : text;
      statusBar.textContent = isVariationMode ? `Variation \u2014 ${withMoveCursor}` : withMoveCursor;
    }
    function renderSide() {
      const isWhite = chess.turn() === "w";
      turnDot.className = `turn-dot ${isWhite ? "white" : "black"}`;
      turnLabel.textContent = isWhite ? "White" : "Black";
      fenDisplay.value = chess.fen();
      renderMoveList();
      renderEngineFeedback();
    }
    function renderMoveList() {
      const sans = moveHistory.map((move) => move.san ?? "\u2014");
      if (sans.length === 0) {
        moveList.innerHTML = '<div class="empty-state">No moves yet.</div>';
        return;
      }
      const rows = [];
      for (let i = 0; i < sans.length; i += 2) {
        const num = Math.floor(i / 2) + 1;
        const wIdx = i + 1;
        const bIdx = i + 2;
        const wActive = cursor === wIdx ? " active-half" : "";
        const bActive = cursor === bIdx ? " active-half" : "";
        const bSan = sans[i + 1] ?? "";
        const whiteEval = analysisByPly[wIdx];
        const blackEval = analysisByPly[bIdx];
        const whiteBadge = whiteEval ? `<span class="move-quality-badge ${whiteEval.category}">${whiteEval.label}</span>` : "";
        const blackBadge = blackEval ? `<span class="move-quality-badge ${blackEval.category}">${blackEval.label}</span>` : "";
        rows.push(`
      <div class="analyze-move-row">
        <strong>${num}.</strong>
        <span class="${wActive}" data-idx="${wIdx}">${sans[i]}${whiteBadge}</span>
        <span class="${bActive}" data-idx="${bIdx}">${bSan}${blackBadge}</span>
      </div>`);
      }
      moveList.innerHTML = rows.join("");
      const activeEl = moveList.querySelector(".active-half");
      if (activeEl) {
        const containerRect = moveList.getBoundingClientRect();
        const elRect = activeEl.getBoundingClientRect();
        const relTop = elRect.top - containerRect.top + moveList.scrollTop;
        const relBottom = relTop + elRect.height;
        if (relBottom > moveList.scrollTop + moveList.clientHeight) {
          moveList.scrollTop = relBottom - moveList.clientHeight;
        } else if (relTop < moveList.scrollTop) {
          moveList.scrollTop = relTop;
        }
      }
    }
    function renderNav() {
      if (fullAnalysisInProgress) {
        navFirst.disabled = true;
        navPrev.disabled = true;
        navNext.disabled = true;
        navLast.disabled = true;
        return;
      }
      navFirst.disabled = cursor === 0;
      navPrev.disabled = cursor === 0;
      navNext.disabled = cursor === fenHistory.length - 1;
      navLast.disabled = cursor === fenHistory.length - 1;
    }
    function updateAnalysisLoadingOverlay() {
      const total = Math.max(analysisProgressTotal, 0);
      const completed = Math.max(0, Math.min(analysisProgressCompleted, total || analysisProgressCompleted));
      const percent = total > 0 ? Math.min(100, Math.round(completed / total * 100)) : 0;
      if (fullAnalysisInProgress) {
        stopActiveMoveAnimation();
      }
      analysisLoadingStatus.textContent = `${completed} / ${total} moves analyzed (${percent}%)`;
      analysisLoadingFill.style.width = `${percent}%`;
      analysisLoadingOverlay.hidden = !fullAnalysisInProgress;
      document.body.classList.toggle("analysis-loading-active", fullAnalysisInProgress);
    }
    function hideAnalysisSummaryOverlay(acknowledged = false) {
      analysisSummaryAcknowledged = acknowledged;
      analysisSummaryOverlay.hidden = true;
      document.body.classList.remove("analysis-summary-active");
      renderSide();
    }
    function showAnalysisSummaryOverlay(summary) {
      analysisSummaryAcknowledged = false;
      const metrics = [
        { key: "excellent", label: "Excellent", value: summary.totals.excellent },
        { key: "great", label: "Great", value: summary.totals.great },
        { key: "brilliant", label: "Brilliant", value: summary.totals.brilliant },
        { key: "blunder", label: "Blunder", value: summary.totals.blunder }
      ].filter((metric) => metric.value > 0);
      if (metrics.length === 0) {
        analysisSummaryCounts.innerHTML = '<p class="analysis-summary-empty">No excellent, great, brilliant, or blunder moves in this game.</p>';
      } else {
        analysisSummaryCounts.innerHTML = metrics.map((metric) => `
      <article class="analysis-summary-metric metric-${metric.key}" aria-label="${metric.label} moves: ${metric.value}">
        <span class="metric-symbol">${SUMMARY_CATEGORY_SYMBOLS[metric.key]}</span>
        <span class="metric-count">${metric.value}</span>
        <span class="metric-label">${metric.label}</span>
      </article>
    `).join("");
      }
      analysisSummaryOverlay.hidden = false;
      document.body.classList.add("analysis-summary-active");
    }
    function stopActiveMoveAnimation() {
      if (activeGhostAnimation) {
        activeGhostAnimation.cancel();
        activeGhostAnimation = null;
      }
      if (activeGhostNode) {
        activeGhostNode.remove();
        activeGhostNode = null;
      }
      if (activeGhostDestinationPiece) {
        activeGhostDestinationPiece.style.visibility = "";
        activeGhostDestinationPiece = null;
      }
      pendingBoardRefresh = false;
    }
    function getCheckedKingSquare() {
      if (!chess.isCheck()) {
        return null;
      }
      const checkedColor = chess.turn();
      for (const squareName of buildSquareList("w")) {
        const square = squareName;
        const piece = chess.get(square);
        if (piece?.type === "k" && piece.color === checkedColor) {
          return square;
        }
      }
      return null;
    }
    function animateLastMove(lastMove) {
      if (!lastMove || cursor === 0 || fullAnalysisInProgress) {
        lastAnimatedMoveKey = null;
        return;
      }
      const moveKey = `${cursor}:${lastMove.from}:${lastMove.to}:${lastMove.san ?? ""}`;
      if (lastAnimatedMoveKey === moveKey) {
        return;
      }
      lastAnimatedMoveKey = moveKey;
      if (suppressAnimationForMove) {
        const matchesSuppressedDrag = suppressAnimationForMove.from === lastMove.from && suppressAnimationForMove.to === lastMove.to;
        suppressAnimationForMove = null;
        if (matchesSuppressedDrag) {
          return;
        }
      }
      const fromSquareButton = boardEl.querySelector(`[data-square="${lastMove.from}"]`);
      const toSquareButton = boardEl.querySelector(`[data-square="${lastMove.to}"]`);
      const destinationPiece = toSquareButton?.querySelector(".piece");
      if (!fromSquareButton || !toSquareButton || !destinationPiece) {
        return;
      }
      stopActiveMoveAnimation();
      const fromRect = fromSquareButton.getBoundingClientRect();
      const toRect = toSquareButton.getBoundingClientRect();
      const startX = fromRect.left + fromRect.width / 2 + window.scrollX;
      const startY = fromRect.top + fromRect.height / 2 + window.scrollY;
      const endX = toRect.left + toRect.width / 2 + window.scrollX;
      const endY = toRect.top + toRect.height / 2 + window.scrollY;
      const deltaX = startX - endX;
      const deltaY = startY - endY;
      const computed = window.getComputedStyle(destinationPiece);
      const pieceRect = destinationPiece.getBoundingClientRect();
      const ghostPiece = destinationPiece.cloneNode(true);
      Object.assign(ghostPiece.style, {
        position: "absolute",
        left: `${endX}px`,
        top: `${endY}px`,
        width: `${pieceRect.width}px`,
        height: `${pieceRect.height}px`,
        transform: "translate3d(-50%, -50%, 0)",
        margin: "0",
        zIndex: "9999",
        pointerEvents: "none",
        fontSize: computed.fontSize,
        fontFamily: computed.fontFamily,
        color: computed.color,
        filter: computed.filter,
        textShadow: computed.textShadow,
        lineHeight: "1",
        animation: "none",
        opacity: "1",
        willChange: "transform"
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
    function animateLastMoveEpic(lastMove) {
      if (!lastMove || cursor === 0 || fullAnalysisInProgress) {
        lastAnimatedMoveKey = null;
        return;
      }
      const moveKey = `${cursor}:${lastMove.from}:${lastMove.to}:${lastMove.san ?? ""}`;
      if (lastAnimatedMoveKey === moveKey) {
        return;
      }
      lastAnimatedMoveKey = moveKey;
      if (suppressAnimationForMove) {
        const matchesSuppressedDrag = suppressAnimationForMove.from === lastMove.from && suppressAnimationForMove.to === lastMove.to;
        suppressAnimationForMove = null;
        if (matchesSuppressedDrag) {
          return;
        }
      }
      const fromSquareButton = boardEl.querySelector(`[data-square="${lastMove.from}"]`);
      const toSquareButton = boardEl.querySelector(`[data-square="${lastMove.to}"]`);
      const destinationPiece = toSquareButton?.querySelector(".piece");
      if (!fromSquareButton || !toSquareButton || !destinationPiece) {
        return;
      }
      stopActiveMoveAnimation();
      const fromRect = fromSquareButton.getBoundingClientRect();
      const toRect = toSquareButton.getBoundingClientRect();
      const startX = fromRect.left + fromRect.width / 2 + window.scrollX;
      const startY = fromRect.top + fromRect.height / 2 + window.scrollY;
      const endX = toRect.left + toRect.width / 2 + window.scrollX;
      const endY = toRect.top + toRect.height / 2 + window.scrollY;
      const deltaX = startX - endX;
      const deltaY = startY - endY;
      const computed = window.getComputedStyle(destinationPiece);
      const pieceRect = destinationPiece.getBoundingClientRect();
      const ghostPiece = destinationPiece.cloneNode(true);
      Object.assign(ghostPiece.style, {
        position: "absolute",
        left: `${endX}px`,
        top: `${endY}px`,
        width: `${pieceRect.width}px`,
        height: `${pieceRect.height}px`,
        transform: "translate3d(-50%, -50%, 0)",
        margin: "0",
        zIndex: "9999",
        pointerEvents: "none",
        fontSize: computed.fontSize,
        fontFamily: computed.fontFamily,
        color: computed.color,
        filter: computed.filter,
        textShadow: computed.textShadow,
        lineHeight: "1",
        animation: "none",
        opacity: "1",
        willChange: "transform",
        perspective: "1000px"
      });
      destinationPiece.style.visibility = "hidden";
      activeGhostNode = ghostPiece;
      activeGhostDestinationPiece = destinationPiece;
      document.body.append(ghostPiece);
      const aura = "";
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
      });
      activeGhostAnimation = animation;
      let finalized = false;
      const onEnd = () => {
        if (finalized) return;
        finalized = true;
        ghostPiece.remove();
        destinationPiece.style.visibility = "";
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
    function requestBoardRefresh() {
      if (activeGhostAnimation) {
        pendingBoardRefresh = true;
        return;
      }
      renderBoard();
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
        return;
      }
      arrowAnnotations.clear();
      squareAnnotations.clear();
      renderArrows();
      renderBoard();
    }
    function clearLiveBestMoveArrow() {
      bestMoveArrowToken += 1;
      liveBestMoveArrow = null;
      liveBestMoveArrowFen = null;
      liveBestMoveRequestFen = null;
    }
    async function maybeUpdateLiveBestMoveArrow(force = false) {
      if (!bestMovesEnabled) {
        return;
      }
      const currentFen = chess.fen();
      if (!force && liveBestMoveArrowFen === currentFen && liveBestMoveArrow) {
        return;
      }
      if (liveBestMoveRequestFen === currentFen) {
        return;
      }
      liveBestMoveRequestFen = currentFen;
      const token = ++bestMoveArrowToken;
      try {
        const evaluation = await ensureStockfish().evaluateFen(currentFen, Math.max(8, analysisDepth));
        if (token !== bestMoveArrowToken) {
          return;
        }
        liveBestMoveArrow = parseBestMoveArrow(evaluation.bestMove);
        liveBestMoveArrowFen = currentFen;
      } catch {
        if (token !== bestMoveArrowToken) {
          return;
        }
        liveBestMoveArrow = null;
        liveBestMoveArrowFen = currentFen;
      } finally {
        if (token === bestMoveArrowToken) {
          liveBestMoveRequestFen = null;
          renderArrows();
        }
      }
    }
    function getSquareFromPoint(clientX, clientY) {
      const node2 = document.elementFromPoint(clientX, clientY);
      const squareButton = node2?.closest(".square");
      return squareButton?.dataset.square ?? null;
    }
    function squareCenter(square) {
      const file2 = square.charCodeAt(0) - 97;
      const rank2 = Number(square[1]) - 1;
      const col = orientation === "w" ? file2 : 7 - file2;
      const row = orientation === "w" ? 7 - rank2 : rank2;
      return {
        x: col * 100 + 50,
        y: row * 100 + 50
      };
    }
    function triggerCheckFlash() {
      const flash = document.createElement("div");
      flash.className = "check-flash-overlay";
      document.body.append(flash);
      flash.addEventListener("animationend", () => flash.remove(), { once: true });
    }
    function spawnBloodSplatter(square, capturedPiece) {
      const boardWrap2 = boardEl.parentElement;
      if (!boardWrap2) {
        return;
      }
      const intensityByPiece = {
        p: 1,
        n: 1.28,
        b: 1.32,
        r: 1.5,
        q: 2.05,
        k: 1.75
      };
      const intensity = intensityByPiece[capturedPiece] ?? 1;
      const center = squareCenter(square);
      const splatter = document.createElement("div");
      splatter.className = "capture-splatter";
      splatter.style.left = `${center.x / 800 * 100}%`;
      splatter.style.top = `${center.y / 800 * 100}%`;
      splatter.style.setProperty("--intensity", String(intensity));
      const dropCount = Math.max(8, Math.floor((10 + Math.random() * 8) * Math.min(intensity, 1.5)));
      for (let index = 0; index < dropCount; index += 1) {
        const drop = document.createElement("span");
        drop.className = "capture-drop";
        const red = 110 + Math.floor(Math.random() * 145);
        const green = 0 + Math.floor(Math.random() * 32);
        const blue = 0 + Math.floor(Math.random() * 18);
        const opacity = 0.82 + Math.random() * 0.18;
        const angle = Math.random() * Math.PI * 2;
        const distance = (24 + Math.random() * 48) * (0.92 + intensity * 0.22);
        const size = (6.8 + Math.random() * 12.8) * (0.92 + intensity * 0.18);
        const smear = 0.88 + Math.random() * (0.85 + intensity * 0.18);
        const stretch = 0.88 + Math.random() * 1.2;
        const trail = 0.92 + Math.random() * 1.2;
        drop.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
        drop.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
        drop.style.setProperty("--size", `${size}px`);
        drop.style.setProperty("--delay", `${Math.random() * 120}ms`);
        drop.style.setProperty("--smear", `${smear}`);
        drop.style.setProperty("--stretch", `${stretch}`);
        drop.style.setProperty("--trail", `${trail}`);
        drop.style.setProperty("--blood-color", `rgba(${red},${green},${blue},${opacity})`);
        splatter.append(drop);
      }
      boardWrap2.append(splatter);
      if (Math.random() > 0.52 && document.querySelectorAll(".capture-blood-pool").length < 3) {
        const pool = document.createElement("div");
        pool.className = "capture-blood-pool";
        pool.style.left = splatter.style.left;
        pool.style.top = splatter.style.top;
        const poolSize = (32 + Math.random() * 32) * (1.1 + intensity * 0.18);
        pool.style.width = `${poolSize}px`;
        pool.style.height = `${poolSize * (0.82 + Math.random() * 0.18)}px`;
        pool.style.setProperty("--pool-color", `rgba(${110 + Math.floor(Math.random() * 145)},0,0,${0.22 + Math.random() * 0.18})`);
        pool.style.setProperty("--pool-blur", `${1.8 + Math.random() * 1.8}px`);
        pool.style.setProperty("--pool-rotate", `${Math.random() * 360}deg`);
        pool.style.transform = `translate(-50%, -50%) rotate(${Math.random() * 360}deg)`;
        boardWrap2.append(pool);
        setTimeout(() => {
          pool.classList.add("capture-blood-pool-fade");
          setTimeout(() => pool.remove(), 2200 + Math.random() * 1200);
        }, 2200 + Math.random() * 1200);
      }
      setTimeout(() => {
        splatter.classList.add("capture-splatter-fade");
        setTimeout(() => splatter.remove(), 3200 + Math.random() * 1800);
      }, 3200 + Math.random() * 1800);
    }
    function boardPointFromClient(clientX, clientY) {
      const rect = boardEl.getBoundingClientRect();
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
    function currentBestMoveArrow() {
      if (!bestMovesEnabled || liveBestMoveArrowFen !== chess.fen()) {
        return null;
      }
      return liveBestMoveArrow;
    }
    function updateBestMovesToggleButton() {
      bestMovesToggleButton.textContent = bestMovesEnabled ? "Best Moves: On" : "Best Moves: Off";
      bestMovesToggleButton.classList.toggle("best-moves-enabled", bestMovesEnabled);
    }
    function updateVariationToolbar() {
      returnGameLineButton.disabled = !isVariationMode;
    }
    function enterVariationMode(branchPly) {
      if (!isVariationMode) {
        gameLineFenHistory = [...fenHistory];
        gameLineMoveHistory = [...moveHistory];
        gameLineAnalysisByPly = [...analysisByPly];
      }
      isVariationMode = true;
      variationBranchPly = branchPly;
      variationReturnCursor = Math.min(gameLineFenHistory.length - 1, branchPly + 1);
    }
    function clearVariationMode() {
      isVariationMode = false;
      variationBranchPly = null;
      variationReturnCursor = 0;
    }
    function syncGameLineFromCurrent() {
      if (isVariationMode) {
        return;
      }
      gameLineFenHistory = [...fenHistory];
      gameLineMoveHistory = [...moveHistory];
      gameLineAnalysisByPly = [...analysisByPly];
    }
    function returnToGameLine() {
      if (!isVariationMode) {
        return;
      }
      const returnMoveNo = Math.max(0, Math.min(variationReturnCursor, gameLineFenHistory.length - 1));
      fenHistory = [...gameLineFenHistory];
      moveHistory = [...gameLineMoveHistory];
      analysisByPly = [...gameLineAnalysisByPly];
      cursor = Math.max(0, Math.min(variationReturnCursor, fenHistory.length - 1));
      chess.load(fenHistory[cursor]);
      clearVariationMode();
      clearSelection();
      clearArrows();
      render();
      showToast(`Returned to game line (move ${returnMoveNo}).`);
    }
    function renderArrows() {
      arrowLayer.innerHTML = buildArrowLayerMarkup({
        variant: "analyze",
        annotations: arrowAnnotations,
        preview: arrowDragFrom && arrowDragPointer ? { from: arrowDragFrom, pointer: arrowDragPointer } : null,
        bestMove: currentBestMoveArrow(),
        squareCenter
      });
    }
    async function runGameAnalysis() {
      if (analysisInProgress) {
        showToast("Analysis is already running.");
        return;
      }
      if (moveHistory.length === 0) {
        showToast("Play or load moves first.");
        return;
      }
      analysisRunId += 1;
      const runId = analysisRunId;
      let completedSuccessfully = false;
      analysisInProgress = true;
      fullAnalysisInProgress = true;
      hideAnalysisSummaryOverlay();
      stopActiveMoveAnimation();
      analysisProgressCompleted = 0;
      analysisProgressTotal = moveHistory.length;
      updateAnalysisLoadingOverlay();
      renderSide();
      renderNav();
      try {
        const engine = ensureStockfish();
        for (let ply = 1; ply <= moveHistory.length; ply += 1) {
          if (runId !== analysisRunId) {
            return;
          }
          const beforeFen = fenHistory[ply - 1];
          const afterFen = fenHistory[ply];
          const move = moveHistory[ply - 1];
          const before = await engine.evaluateFen(beforeFen, analysisDepth);
          if (runId !== analysisRunId) {
            return;
          }
          const after = await engine.evaluateFen(afterFen, analysisDepth);
          if (runId !== analysisRunId) {
            return;
          }
          analysisByPly[ply] = await classifyMove(ply, move, before, after, beforeFen, afterFen, engine);
          analysisProgressCompleted = ply;
          updateAnalysisLoadingOverlay();
          if (cursor === ply) {
            requestBoardRefresh();
          }
          renderSide();
        }
        completedSuccessfully = true;
        showToast("Analysis complete.");
        if (!isVariationMode) {
          syncGameLineFromCurrent();
        }
      } catch {
        showToast("Engine failed to analyze this game.");
      } finally {
        if (runId === analysisRunId) {
          analysisInProgress = false;
          fullAnalysisInProgress = false;
          updateAnalysisLoadingOverlay();
          renderSide();
          renderNav();
          if (completedSuccessfully) {
            const summary = buildGameAnalysisSummary();
            if (summary) {
              showAnalysisSummaryOverlay(summary);
            }
          }
        }
      }
    }
    async function analyzeLatestMove() {
      const ply = moveHistory.length;
      if (ply <= 0) {
        return;
      }
      if (analysisByPly[ply]) {
        return;
      }
      analysisRunId += 1;
      const runId = analysisRunId;
      analysisInProgress = true;
      renderSide();
      try {
        const engine = ensureStockfish();
        const beforeFen = fenHistory[ply - 1];
        const afterFen = fenHistory[ply];
        const move = moveHistory[ply - 1];
        const before = await engine.evaluateFen(beforeFen, analysisDepth);
        if (runId !== analysisRunId) {
          return;
        }
        const after = await engine.evaluateFen(afterFen, analysisDepth);
        if (runId !== analysisRunId) {
          return;
        }
        analysisByPly[ply] = await classifyMove(ply, move, before, after, beforeFen, afterFen, engine);
        if (!isVariationMode) {
          syncGameLineFromCurrent();
        }
        if (cursor === ply) {
          requestBoardRefresh();
        }
      } catch {
      } finally {
        if (runId === analysisRunId) {
          analysisInProgress = false;
          renderSide();
        }
      }
    }
    function ensureStockfish() {
      if (!stockfish) {
        stockfish = new StockfishBridge();
      }
      return stockfish;
    }
    function cancelAnalysis() {
      analysisRunId += 1;
      analysisInProgress = false;
      fullAnalysisInProgress = false;
      analysisProgressCompleted = 0;
      analysisProgressTotal = 0;
      hideAnalysisSummaryOverlay();
      updateAnalysisLoadingOverlay();
      renderNav();
    }
    async function classifyMove(ply, move, before, after, beforeFen, afterFen, engine) {
      const playedMove = toUci(move);
      const beforeMoverCp = before.cp;
      const afterMoverCp = -after.cp;
      const cpl = Math.max(0, Math.round(beforeMoverCp - afterMoverCp));
      const matchesBest = before.bestMove.startsWith(playedMove);
      const moverColor = beforeFen.split(" ")[1] || "w";
      const materialBefore = materialFromPerspective(beforeFen, moverColor);
      const materialAfter = materialFromPerspective(afterFen, moverColor);
      const materialDelta = materialAfter - materialBefore;
      const evalGain = Math.round(afterMoverCp - beforeMoverCp);
      const previousOpponentCategory = ply > 1 ? analysisByPly[ply - 1]?.category : void 0;
      const brilliantOffer = await verifyBrilliantOffer({
        engine,
        move,
        beforeFen,
        afterFen,
        beforeMoverCp,
        afterMoverCp,
        cpl,
        matchesBest,
        materialDelta
      });
      const quality = classifyMoveQuality({
        cpl,
        matchesBest,
        materialDelta,
        evalGain,
        isCapture: Boolean(move.captured),
        previousOpponentCategory,
        brilliantOffer: brilliantOffer.brilliantOffer
      });
      const note = buildMoveNote(quality.category, cpl, before, playedMove, move, materialDelta, evalGain, brilliantOffer.note);
      return {
        ply,
        label: quality.label,
        category: quality.category,
        cpl,
        playedMove,
        bestMove: before.bestMove,
        note,
        beforeCp: Math.round(beforeMoverCp),
        afterCp: Math.round(afterMoverCp)
      };
    }
    function classifyMoveQuality(input) {
      const {
        cpl,
        matchesBest,
        materialDelta,
        evalGain,
        isCapture,
        previousOpponentCategory,
        brilliantOffer
      } = input;
      const opponentBlundered = previousOpponentCategory === "mistake" || previousOpponentCategory === "blunder";
      const isSacrifice = materialDelta <= -100;
      const brilliantSacrifice = isSacrifice && evalGain >= 80 && cpl <= 35;
      const greatPunish = matchesBest && cpl <= 22 && opponentBlundered && (isCapture || materialDelta >= 100 || evalGain >= 110);
      if (brilliantSacrifice || brilliantOffer) {
        return { category: "brilliant", label: CATEGORY_LABELS.brilliant };
      }
      if (greatPunish) {
        return { category: "great", label: CATEGORY_LABELS.great };
      }
      if (cpl <= 45) {
        return { category: "excellent", label: CATEGORY_LABELS.excellent };
      }
      if (cpl <= 90) {
        return { category: "good", label: CATEGORY_LABELS.good };
      }
      if (cpl <= 160) {
        return { category: "inaccuracy", label: CATEGORY_LABELS.inaccuracy };
      }
      if (cpl <= 280) {
        return { category: "mistake", label: CATEGORY_LABELS.mistake };
      }
      return { category: "blunder", label: CATEGORY_LABELS.blunder };
    }
    function toUci(move) {
      const promotion = move.promotion ?? "";
      return `${move.from}${move.to}${promotion}`;
    }
    function materialFromPerspective(fen, color) {
      const board = fen.split(" ")[0] ?? "";
      let white = 0;
      let black = 0;
      for (const ch of board) {
        if (ch === "/" || /\d/.test(ch)) {
          continue;
        }
        const value = PIECE_VALUES[ch.toLowerCase()] ?? 0;
        if (ch === ch.toUpperCase()) {
          white += value;
        } else {
          black += value;
        }
      }
      return color === "w" ? white - black : black - white;
    }
    function buildMoveNote(category, cpl, before, playedMove, move, materialDelta, evalGain, brilliantOfferNote) {
      if (category === "brilliant") {
        if (brilliantOfferNote) {
          return brilliantOfferNote;
        }
        return `Intentional sacrifice (${materialDelta}) with strong compensation (+${Math.max(0, evalGain)} cp).`;
      }
      if (category === "great") {
        return `Best practical punishment after opponent error (${cpl} CPL).`;
      }
      if (category === "blunder") {
        return `Large drop (${cpl} CPL). Engine preferred ${before.bestMove || "another move"}.`;
      }
      if (category === "mistake") {
        return `Significant accuracy loss (${cpl} CPL). Better: ${before.bestMove || "engine alternative"}.`;
      }
      if (category === "inaccuracy") {
        return `Minor loss (${cpl} CPL). Better was ${before.bestMove || "engine line"}.`;
      }
      if (move.san.includes("+") || move.captured) {
        return "Active move that keeps practical pressure.";
      }
      return `Stable move (${cpl} CPL).`;
    }
    async function verifyBrilliantOffer(input) {
      const {
        engine,
        move,
        beforeFen,
        afterFen,
        beforeMoverCp,
        afterMoverCp,
        cpl,
        matchesBest,
        materialDelta
      } = input;
      if (materialDelta < 0 || cpl > 35 || !matchesBest && afterMoverCp < beforeMoverCp - 40) {
        return { brilliantOffer: false };
      }
      const movedPieceValue = PIECE_VALUES[move.piece] ?? 0;
      if (movedPieceValue < 330) {
        return { brilliantOffer: false };
      }
      const board = new Chess(afterFen);
      const captureReplies = board.moves({ verbose: true }).filter((reply) => {
        if (reply.to !== move.to || !reply.captured) {
          return false;
        }
        const capturerValue = PIECE_VALUES[reply.piece] ?? 0;
        return capturerValue <= movedPieceValue;
      });
      if (captureReplies.length === 0) {
        return { brilliantOffer: false };
      }
      let worstReplyScore = Number.POSITIVE_INFINITY;
      const examinedReplies = captureReplies.slice(0, 3);
      for (const reply of examinedReplies) {
        const replyBoard = new Chess(afterFen);
        replyBoard.move(reply);
        const replyEval = await engine.evaluateFen(replyBoard.fen(), Math.max(BRILLIANT_VERIFICATION_DEPTH, analysisDepth + 2));
        worstReplyScore = Math.min(worstReplyScore, replyEval.cp);
      }
      const keepsAdvantage = worstReplyScore >= Math.max(150, beforeMoverCp - 90);
      if (!keepsAdvantage) {
        return { brilliantOffer: false };
      }
      const replySans = examinedReplies.map((reply) => reply.san).join(", ");
      return {
        brilliantOffer: true,
        note: `Brilliant piece offer: ${move.san} invites ${replySans}, but the deeper line still keeps a winning evaluation.`
      };
    }
    function calculateAccuracy(moves) {
      if (moves.length === 0) return 100;
      const winProbability = (cp) => {
        const clampedCp = Math.max(-4e3, Math.min(4e3, cp));
        return 50 + 50 * (2 / (1 + Math.exp(-368208e-8 * clampedCp)) - 1);
      };
      let totalAccuracy = 0;
      for (const move of moves) {
        const wpBefore = winProbability(move.beforeCp);
        const wpAfter = winProbability(move.afterCp);
        const loss = Math.max(0, wpBefore - wpAfter);
        const moveAcc = 103.1668 * Math.exp(-0.04354 * loss) - 3.1669;
        totalAccuracy += Math.max(0, Math.min(100, moveAcc));
      }
      return Math.round(totalAccuracy / moves.length);
    }
    function estimatePlayerElo(accuracy, averageCpl) {
      const normalizedAccuracy = Math.max(0, Math.min(100, accuracy));
      const normalizedCpl = Math.max(0, Math.min(600, averageCpl));
      const fromAccuracy = 700 + Math.pow(normalizedAccuracy / 100, 1.7) * 2200;
      const fromCpl = 2900 - normalizedCpl * 4.1;
      const estimated = fromAccuracy * 0.58 + fromCpl * 0.42;
      return Math.round(Math.max(400, Math.min(3e3, estimated)));
    }
    function escapeHtml(text) {
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
    }
    function buildGameAnalysisSummary() {
      const all = analysisByPly.filter((entry) => Boolean(entry));
      if (all.length === 0) {
        return null;
      }
      const whiteMoves = all.filter((move) => move.ply % 2 !== 0);
      const blackMoves = all.filter((move) => move.ply % 2 === 0);
      const summarizeSide = (moves, name) => {
        const excellent = moves.filter((move) => move.category === "excellent").length;
        const great = moves.filter((move) => move.category === "great").length;
        const brilliant = moves.filter((move) => move.category === "brilliant").length;
        const blunder = moves.filter((move) => move.category === "blunder").length;
        const averageCpl = moves.length > 0 ? Math.round(moves.reduce((sum, move) => sum + move.cpl, 0) / moves.length) : 0;
        const accuracy = calculateAccuracy(moves);
        return {
          name,
          moveCount: moves.length,
          accuracy,
          averageCpl,
          estimatedElo: estimatePlayerElo(accuracy, averageCpl),
          categoryCounts: {
            excellent,
            great,
            brilliant,
            blunder
          }
        };
      };
      const white = summarizeSide(whiteMoves, analyzedWhiteName);
      const black = summarizeSide(blackMoves, analyzedBlackName);
      return {
        white,
        black,
        totals: {
          excellent: white.categoryCounts.excellent + black.categoryCounts.excellent,
          great: white.categoryCounts.great + black.categoryCounts.great,
          brilliant: white.categoryCounts.brilliant + black.categoryCounts.brilliant,
          blunder: white.categoryCounts.blunder + black.categoryCounts.blunder
        }
      };
    }
    function renderEngineFeedback() {
      stopAnalyzeBtn.hidden = !fullAnalysisInProgress;
      stopAnalyzeBtn.disabled = !fullAnalysisInProgress;
      analyzeBtn.disabled = analysisInProgress;
      if (analysisInProgress) {
        engineFeedback.innerHTML = `<p class="engine-inline">Analyzing... ${analysisByPly.filter(Boolean).length}/${moveHistory.length} moves complete.</p>`;
        return;
      }
      const summary = buildGameAnalysisSummary();
      if (!summary) {
        engineFeedback.innerHTML = "Run analysis to get move quality feedback.";
        return;
      }
      const reviewEloBlock = analysisSummaryAcknowledged ? `
      <div class="analysis-review-elo-box">
        <div><strong>${escapeHtml(summary.white.name)}</strong> Elo est. <strong>${summary.white.estimatedElo}</strong></div>
        <div><strong>${escapeHtml(summary.black.name)}</strong> Elo est. <strong>${summary.black.estimatedElo}</strong></div>
      </div>
    ` : "";
      if (cursor === 0) {
        engineFeedback.innerHTML = `
      ${reviewEloBlock}
      <div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(0,0,0,0.1); gap: 10px;">
        <div style="text-align: center; flex: 1;">
          <div style="font-size: 1.1rem; font-weight: 700; color: var(--ink);">${escapeHtml(summary.white.name)}</div>
          <div style="font-size: 1.9rem; font-weight: 700; color: var(--ink);">${summary.white.accuracy}%</div>
          <div style="font-size: 0.8rem; color: var(--muted); text-transform: uppercase;">White Accuracy</div>
        </div>
        <div style="text-align: center; flex: 1;">
          <div style="font-size: 1.1rem; font-weight: 700; color: var(--ink);">${escapeHtml(summary.black.name)}</div>
          <div style="font-size: 1.9rem; font-weight: 700; color: var(--ink);">${summary.black.accuracy}%</div>
          <div style="font-size: 0.8rem; color: var(--muted); text-transform: uppercase;">Black Accuracy</div>
        </div>
      </div>
      <p class="engine-inline">Excellent: <strong>${summary.totals.excellent}</strong> \xB7 Great: <strong>${summary.totals.great}</strong> \xB7 Brilliant: <strong>${summary.totals.brilliant}</strong> \xB7 Blunders: <strong>${summary.totals.blunder}</strong></p>
      <p class="engine-inline" style="margin-top: 10px;">Select a move in the list to see detailed feedback.</p>
    `;
        return;
      }
      const selected = analysisByPly[cursor];
      if (!selected) {
        engineFeedback.innerHTML = `${reviewEloBlock}<p class="engine-inline">Select a move in the list to see detailed feedback.</p>`;
        return;
      }
      engineFeedback.innerHTML = `
    ${reviewEloBlock}
    <p class="engine-inline"><strong>${selected.label}</strong> \xB7 ${selected.playedMove} \xB7 ${selected.cpl} CPL</p>
    <p class="engine-inline">${escapeHtml(selected.note)}</p>
    <p class="engine-inline" style="margin-top: 8px; color: var(--muted);">Engine best: ${escapeHtml(selected.bestMove || "-")}</p>
  `;
    }
    function getLastMove() {
      if (cursor === 0) return void 0;
      return moveHistory[cursor - 1];
    }
    function q(sel) {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`Missing: ${sel}`);
      return el;
    }
    var toastTimer = 0;
    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add("visible");
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2400);
    }
    function applyAnalyzedPlayerNames(whiteName, blackName) {
      analyzedWhiteName = whiteName?.trim() || "White";
      analyzedBlackName = blackName?.trim() || "Black";
    }
    function parsePgnHeaderValue(pgn2, key) {
      const match = pgn2.match(new RegExp(`\\[${key}\\s+"([^"]+)"\\]`, "i"));
      return match?.[1]?.trim() || null;
    }
    function loadMovesIntoBoard(sans) {
      resetBoardStateToStart();
      for (const san of sans) {
        const move = chess.move(san);
        if (!move) {
          return false;
        }
        moveHistory.push(move);
        fenHistory.push(chess.fen());
      }
      cursor = Math.max(0, fenHistory.length - 1);
      syncGameLineFromCurrent();
      gameLineLocked = true;
      return true;
    }
    function loadPgnIntoBoard(pgn2) {
      const normalizedPgn = pgn2.trim();
      if (!normalizedPgn) {
        return false;
      }
      const pgnWhite = parsePgnHeaderValue(normalizedPgn, "White");
      const pgnBlack = parsePgnHeaderValue(normalizedPgn, "Black");
      if (pgnWhite || pgnBlack) {
        applyAnalyzedPlayerNames(pgnWhite, pgnBlack);
      }
      const replay = new Chess();
      try {
        replay.loadPgn(normalizedPgn, { strict: false });
      } catch {
        return false;
      }
      const sans = replay.history();
      if (sans.length === 0) {
        return false;
      }
      return loadMovesIntoBoard(sans);
    }
    window.addEventListener("beforeunload", () => {
      stockfish?.terminate();
    });
    var shouldAutoAnalyzeOnInit = false;
    var postGameMetaRaw = localStorage.getItem(POST_GAME_META_STORAGE_KEY);
    if (postGameMetaRaw) {
      try {
        const parsedMeta = JSON.parse(postGameMetaRaw);
        applyAnalyzedPlayerNames(parsedMeta.whiteName, parsedMeta.blackName);
      } catch {
      }
      localStorage.removeItem(POST_GAME_META_STORAGE_KEY);
    }
    var postGamePgn = localStorage.getItem(POST_GAME_PGN_STORAGE_KEY);
    if (postGamePgn) {
      try {
        localStorage.removeItem(POST_GAME_PGN_STORAGE_KEY);
        localStorage.removeItem(POST_GAME_MOVES_STORAGE_KEY);
        shouldAutoAnalyzeOnInit = loadPgnIntoBoard(postGamePgn);
        if (!shouldAutoAnalyzeOnInit) {
          console.error("Failed to parse postGamePgn into move history");
        }
      } catch (e) {
        console.error("Failed to parse postGamePgn", e);
      }
    } else {
      const postGameMovesStr = localStorage.getItem(POST_GAME_MOVES_STORAGE_KEY);
      if (postGameMovesStr) {
        try {
          const movesToLoad = JSON.parse(postGameMovesStr);
          localStorage.removeItem(POST_GAME_MOVES_STORAGE_KEY);
          shouldAutoAnalyzeOnInit = Array.isArray(movesToLoad) && movesToLoad.length > 0 && loadMovesIntoBoard(movesToLoad);
          if (!shouldAutoAnalyzeOnInit) {
            console.error("Failed to parse postGameMoves into move history");
          }
        } catch (e) {
          console.error("Failed to parse postGameMoves", e);
        }
      }
    }
    syncGameLineFromCurrent();
    render();
    updateAnalysisLoadingOverlay();
    if (shouldAutoAnalyzeOnInit) {
      setTimeout(() => {
        void runGameAnalysis();
      }, 100);
    }
  }
});
export default require_analyze();
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
//# sourceMappingURL=analyze.js.map
