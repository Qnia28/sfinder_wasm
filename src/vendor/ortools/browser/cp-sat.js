// Modified for sfinder-wasm 3.0: unused upstream Worker factory disabled. Apache-2.0 and bundled third-party notices apply.
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf, __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from == "object" || typeof from == "function")
    for (let key of __getOwnPropNames(from))
      !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: !0 }) : target,
  mod
));

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/types.js
var require_types = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/is-message.js
var require_is_message = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/is-message.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.isMessage = isMessage;
    function isMessage(arg, schema) {
      return arg !== null && typeof arg == "object" && "$typeName" in arg && typeof arg.$typeName == "string" ? schema === void 0 ? !0 : schema.typeName === arg.$typeName : !1;
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/descriptors.js
var require_descriptors = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/descriptors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.ScalarType = void 0;
    var ScalarType;
    (function(ScalarType2) {
      ScalarType2[ScalarType2.DOUBLE = 1] = "DOUBLE", ScalarType2[ScalarType2.FLOAT = 2] = "FLOAT", ScalarType2[ScalarType2.INT64 = 3] = "INT64", ScalarType2[ScalarType2.UINT64 = 4] = "UINT64", ScalarType2[ScalarType2.INT32 = 5] = "INT32", ScalarType2[ScalarType2.FIXED64 = 6] = "FIXED64", ScalarType2[ScalarType2.FIXED32 = 7] = "FIXED32", ScalarType2[ScalarType2.BOOL = 8] = "BOOL", ScalarType2[ScalarType2.STRING = 9] = "STRING", ScalarType2[ScalarType2.BYTES = 12] = "BYTES", ScalarType2[ScalarType2.UINT32 = 13] = "UINT32", ScalarType2[ScalarType2.SFIXED32 = 15] = "SFIXED32", ScalarType2[ScalarType2.SFIXED64 = 16] = "SFIXED64", ScalarType2[ScalarType2.SINT32 = 17] = "SINT32", ScalarType2[ScalarType2.SINT64 = 18] = "SINT64";
    })(ScalarType || (exports.ScalarType = ScalarType = {}));
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wire/varint.js
var require_varint = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wire/varint.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.varint64read = varint64read;
    exports.varint64write = varint64write;
    exports.int64FromString = int64FromString;
    exports.int64ToString = int64ToString;
    exports.uInt64ToString = uInt64ToString;
    exports.varint32write = varint32write;
    exports.varint32read = varint32read;
    function varint64read() {
      let buf = this.buf, pos = this.pos, lo = 0, hi = 0;
      for (let shift = 0; shift < 28; shift += 7) {
        let b = buf[pos++];
        if (lo |= (b & 127) << shift, (b & 128) == 0) {
          this.pos = pos, this.assertBounds(), this.varint64Lo = lo, this.varint64Hi = hi;
          return;
        }
      }
      let middleByte = buf[pos++];
      if (lo |= (middleByte & 15) << 28, hi = (middleByte & 112) >> 4, (middleByte & 128) == 0) {
        this.pos = pos, this.assertBounds(), this.varint64Lo = lo, this.varint64Hi = hi;
        return;
      }
      for (let shift = 3; shift <= 31; shift += 7) {
        let b = buf[pos++];
        if (hi |= (b & 127) << shift, (b & 128) == 0) {
          this.pos = pos, this.assertBounds(), this.varint64Lo = lo, this.varint64Hi = hi;
          return;
        }
      }
      throw new Error("invalid varint");
    }
    function varint64write(lo, hi, bytes) {
      for (let i = 0; i < 28; i = i + 7) {
        let shift = lo >>> i, hasNext = !(!(shift >>> 7) && hi == 0), byte = (hasNext ? shift | 128 : shift) & 255;
        if (bytes.push(byte), !hasNext)
          return;
      }
      let splitBits = lo >>> 28 & 15 | (hi & 7) << 4, hasMoreBits = hi >> 3 != 0;
      if (bytes.push((hasMoreBits ? splitBits | 128 : splitBits) & 255), !!hasMoreBits) {
        for (let i = 3; i < 31; i = i + 7) {
          let shift = hi >>> i, hasNext = !!(shift >>> 7), byte = (hasNext ? shift | 128 : shift) & 255;
          if (bytes.push(byte), !hasNext)
            return;
        }
        bytes.push(hi >>> 31 & 1);
      }
    }
    var TWO_PWR_32_DBL2 = 4294967296;
    function int64FromString(dec) {
      let minus = dec[0] === "-";
      minus && (dec = dec.slice(1));
      let base = 1e6, lowBits = 0, highBits = 0;
      function add1e6digit(begin, end) {
        let digit1e6 = Number(dec.slice(begin, end));
        highBits *= base, lowBits = lowBits * base + digit1e6, lowBits >= TWO_PWR_32_DBL2 && (highBits = highBits + (lowBits / TWO_PWR_32_DBL2 | 0), lowBits = lowBits % TWO_PWR_32_DBL2);
      }
      return add1e6digit(-24, -18), add1e6digit(-18, -12), add1e6digit(-12, -6), add1e6digit(-6), minus ? negate2(lowBits, highBits) : newBits(lowBits, highBits);
    }
    function int64ToString(lo, hi) {
      let bits = newBits(lo, hi), negative = bits.hi & 2147483648;
      negative && (bits = negate2(bits.lo, bits.hi));
      let result = uInt64ToString(bits.lo, bits.hi);
      return negative ? "-" + result : result;
    }
    function uInt64ToString(lo, hi) {
      if ({ lo, hi } = toUnsigned2(lo, hi), hi <= 2097151)
        return String(TWO_PWR_32_DBL2 * hi + lo);
      let low = lo & 16777215, mid = (lo >>> 24 | hi << 8) & 16777215, high = hi >> 16 & 65535, digitA = low + mid * 6777216 + high * 6710656, digitB = mid + high * 8147497, digitC = high * 2, base = 1e7;
      return digitA >= base && (digitB += Math.floor(digitA / base), digitA %= base), digitB >= base && (digitC += Math.floor(digitB / base), digitB %= base), digitC.toString() + decimalFrom1e7WithLeadingZeros(digitB) + decimalFrom1e7WithLeadingZeros(digitA);
    }
    function toUnsigned2(lo, hi) {
      return { lo: lo >>> 0, hi: hi >>> 0 };
    }
    function newBits(lo, hi) {
      return { lo: lo | 0, hi: hi | 0 };
    }
    function negate2(lowBits, highBits) {
      return highBits = ~highBits, lowBits ? lowBits = ~lowBits + 1 : highBits += 1, newBits(lowBits, highBits);
    }
    var decimalFrom1e7WithLeadingZeros = (digit1e7) => {
      let partial = String(digit1e7);
      return "0000000".slice(partial.length) + partial;
    };
    function varint32write(value, bytes) {
      if (value >>> 0 < 128) {
        bytes.push(value);
        return;
      }
      if (value >= 0) {
        for (; value > 127; )
          bytes.push(value & 127 | 128), value = value >>> 7;
        bytes.push(value);
      } else {
        for (let i = 0; i < 9; i++)
          bytes.push(value & 127 | 128), value = value >> 7;
        bytes.push(1);
      }
    }
    function varint32read() {
      let b = this.buf[this.pos++];
      if ((b & 128) === 0)
        return this.assertBounds(), b;
      let result = b & 127;
      if (b = this.buf[this.pos++], result |= (b & 127) << 7, (b & 128) === 0)
        return this.assertBounds(), result;
      if (b = this.buf[this.pos++], result |= (b & 127) << 14, (b & 128) === 0)
        return this.assertBounds(), result;
      if (b = this.buf[this.pos++], result |= (b & 127) << 21, (b & 128) === 0)
        return this.assertBounds(), result;
      b = this.buf[this.pos++], result |= (b & 15) << 28;
      for (let readBytes = 5; (b & 128) !== 0 && readBytes < 10; readBytes++)
        b = this.buf[this.pos++];
      if ((b & 128) !== 0)
        throw new Error("invalid varint");
      return this.assertBounds(), result >>> 0;
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/proto-int64.js
var require_proto_int64 = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/proto-int64.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.protoInt64 = void 0;
    var varint_js_1 = require_varint();
    exports.protoInt64 = makeInt64Support();
    function makeInt64Support() {
      let dv = new DataView(new ArrayBuffer(8));
      if (typeof BigInt == "function" && typeof dv.getBigInt64 == "function" && typeof dv.getBigUint64 == "function" && typeof dv.setBigInt64 == "function" && typeof dv.setBigUint64 == "function" && (!!globalThis.Deno || !!globalThis.Bun || typeof process != "object" || typeof process.env != "object" || process.env.BUF_BIGINT_DISABLE !== "1")) {
        let MIN = BigInt("-9223372036854775808"), MAX = BigInt("9223372036854775807"), UMIN = BigInt("0"), UMAX = BigInt("18446744073709551615");
        return {
          zero: BigInt(0),
          supported: !0,
          parse(value) {
            let bi = typeof value == "bigint" ? value : BigInt(value);
            if (bi > MAX || bi < MIN)
              throw new Error(`invalid int64: ${value}`);
            return bi;
          },
          uParse(value) {
            let bi = typeof value == "bigint" ? value : BigInt(value);
            if (bi > UMAX || bi < UMIN)
              throw new Error(`invalid uint64: ${value}`);
            return bi;
          },
          enc(value) {
            return dv.setBigInt64(0, this.parse(value), !0), {
              lo: dv.getInt32(0, !0),
              hi: dv.getInt32(4, !0)
            };
          },
          uEnc(value) {
            return dv.setBigInt64(0, this.uParse(value), !0), {
              lo: dv.getInt32(0, !0),
              hi: dv.getInt32(4, !0)
            };
          },
          dec(lo, hi) {
            return dv.setInt32(0, lo, !0), dv.setInt32(4, hi, !0), dv.getBigInt64(0, !0);
          },
          uDec(lo, hi) {
            return dv.setInt32(0, lo, !0), dv.setInt32(4, hi, !0), dv.getBigUint64(0, !0);
          }
        };
      }
      return {
        zero: "0",
        supported: !1,
        parse(value) {
          return typeof value != "string" && (value = value.toString()), assertInt64String(value), value;
        },
        uParse(value) {
          return typeof value != "string" && (value = value.toString()), assertUInt64String(value), value;
        },
        enc(value) {
          return typeof value != "string" && (value = value.toString()), assertInt64String(value), (0, varint_js_1.int64FromString)(value);
        },
        uEnc(value) {
          return typeof value != "string" && (value = value.toString()), assertUInt64String(value), (0, varint_js_1.int64FromString)(value);
        },
        dec(lo, hi) {
          return (0, varint_js_1.int64ToString)(lo, hi);
        },
        uDec(lo, hi) {
          return (0, varint_js_1.uInt64ToString)(lo, hi);
        }
      };
    }
    function assertInt64String(value) {
      if (!/^-?[0-9]+$/.test(value))
        throw new Error("invalid int64: " + value);
    }
    function assertUInt64String(value) {
      if (!/^[0-9]+$/.test(value))
        throw new Error("invalid uint64: " + value);
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/scalar.js
var require_scalar = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/scalar.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.scalarEquals = scalarEquals;
    exports.scalarZeroValue = scalarZeroValue;
    exports.isScalarZeroValue = isScalarZeroValue;
    var proto_int64_js_1 = require_proto_int64(), descriptors_js_1 = require_descriptors();
    function scalarEquals(type, a, b) {
      if (a === b)
        return !0;
      if (type == descriptors_js_1.ScalarType.BYTES) {
        if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length)
          return !1;
        for (let i = 0; i < a.length; i++)
          if (a[i] !== b[i])
            return !1;
        return !0;
      }
      switch (type) {
        case descriptors_js_1.ScalarType.UINT64:
        case descriptors_js_1.ScalarType.FIXED64:
        case descriptors_js_1.ScalarType.INT64:
        case descriptors_js_1.ScalarType.SFIXED64:
        case descriptors_js_1.ScalarType.SINT64:
          return a == b;
      }
      return !1;
    }
    function scalarZeroValue(type, longAsString) {
      switch (type) {
        case descriptors_js_1.ScalarType.STRING:
          return "";
        case descriptors_js_1.ScalarType.BOOL:
          return !1;
        case descriptors_js_1.ScalarType.DOUBLE:
        case descriptors_js_1.ScalarType.FLOAT:
          return 0;
        case descriptors_js_1.ScalarType.INT64:
        case descriptors_js_1.ScalarType.UINT64:
        case descriptors_js_1.ScalarType.SFIXED64:
        case descriptors_js_1.ScalarType.FIXED64:
        case descriptors_js_1.ScalarType.SINT64:
          return longAsString ? "0" : proto_int64_js_1.protoInt64.zero;
        case descriptors_js_1.ScalarType.BYTES:
          return new Uint8Array(0);
        default:
          return 0;
      }
    }
    function isScalarZeroValue(type, value) {
      switch (type) {
        case descriptors_js_1.ScalarType.BOOL:
          return value === !1;
        case descriptors_js_1.ScalarType.STRING:
          return value === "";
        case descriptors_js_1.ScalarType.BYTES:
          return value instanceof Uint8Array && !value.byteLength;
        case descriptors_js_1.ScalarType.DOUBLE:
        case descriptors_js_1.ScalarType.FLOAT:
          return Object.is(value, 0);
        default:
          return value == 0;
      }
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/unsafe.js
var require_unsafe = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/unsafe.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.unsafeLocal = void 0;
    exports.unsafeOneofCase = unsafeOneofCase;
    exports.unsafeIsSet = unsafeIsSet;
    exports.unsafeIsSetExplicit = unsafeIsSetExplicit;
    exports.unsafeGet = unsafeGet;
    exports.unsafeSet = unsafeSet;
    exports.unsafeClear = unsafeClear;
    var scalar_js_1 = require_scalar(), IMPLICIT = 2;
    exports.unsafeLocal = /* @__PURE__ */ Symbol.for("reflect unsafe local");
    function unsafeOneofCase(target, oneof) {
      let c = target[oneof.localName].case;
      return c === void 0 ? c : oneof.fields.find((f) => f.localName === c);
    }
    function unsafeIsSet(target, field) {
      let name = field.localName;
      if (field.oneof)
        return target[field.oneof.localName].case === name;
      if (field.presence != IMPLICIT)
        return target[name] !== void 0 && Object.prototype.hasOwnProperty.call(target, name);
      switch (field.fieldKind) {
        case "list":
          return target[name].length > 0;
        case "map":
          return Object.keys(target[name]).length > 0;
        case "scalar":
          return !(0, scalar_js_1.isScalarZeroValue)(field.scalar, target[name]);
        case "enum":
          return target[name] !== field.enum.values[0].number;
      }
      throw new Error("message field with implicit presence");
    }
    function unsafeIsSetExplicit(target, localName) {
      return Object.prototype.hasOwnProperty.call(target, localName) && target[localName] !== void 0;
    }
    function unsafeGet(target, field) {
      if (field.oneof) {
        let oneof = target[field.oneof.localName];
        return oneof.case === field.localName ? oneof.value : void 0;
      }
      return target[field.localName];
    }
    function unsafeSet(target, field, value) {
      field.oneof ? target[field.oneof.localName] = {
        case: field.localName,
        value
      } : target[field.localName] = value;
    }
    function unsafeClear(target, field) {
      let name = field.localName;
      if (field.oneof) {
        let oneofLocalName = field.oneof.localName;
        target[oneofLocalName].case === name && (target[oneofLocalName] = { case: void 0 });
      } else if (field.presence != IMPLICIT)
        delete target[name];
      else
        switch (field.fieldKind) {
          case "map":
            target[name] = {};
            break;
          case "list":
            target[name] = [];
            break;
          case "enum":
            target[name] = field.enum.values[0].number;
            break;
          case "scalar":
            target[name] = (0, scalar_js_1.scalarZeroValue)(field.scalar, field.longAsString);
            break;
        }
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/guard.js
var require_guard = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/guard.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.isObject = isObject;
    exports.isOneofADT = isOneofADT;
    exports.isReflectList = isReflectList;
    exports.isReflectMap = isReflectMap;
    exports.isReflectMessage = isReflectMessage;
    var unsafe_js_1 = require_unsafe();
    function isObject(arg) {
      return arg !== null && typeof arg == "object" && !Array.isArray(arg);
    }
    function isOneofADT(arg) {
      return arg !== null && typeof arg == "object" && "case" in arg && (typeof arg.case == "string" && "value" in arg && arg.value != null || arg.case === void 0 && (!("value" in arg) || arg.value === void 0));
    }
    function isReflectList(arg, field) {
      var _a, _b, _c, _d;
      if (isObject(arg) && unsafe_js_1.unsafeLocal in arg && "add" in arg && "field" in arg && typeof arg.field == "function") {
        if (field !== void 0) {
          let a = field, b = arg.field();
          return a.listKind == b.listKind && a.scalar === b.scalar && ((_a = a.message) === null || _a === void 0 ? void 0 : _a.typeName) === ((_b = b.message) === null || _b === void 0 ? void 0 : _b.typeName) && ((_c = a.enum) === null || _c === void 0 ? void 0 : _c.typeName) === ((_d = b.enum) === null || _d === void 0 ? void 0 : _d.typeName);
        }
        return !0;
      }
      return !1;
    }
    function isReflectMap(arg, field) {
      var _a, _b, _c, _d;
      if (isObject(arg) && unsafe_js_1.unsafeLocal in arg && "has" in arg && "field" in arg && typeof arg.field == "function") {
        if (field !== void 0) {
          let a = field, b = arg.field();
          return a.mapKey === b.mapKey && a.mapKind == b.mapKind && a.scalar === b.scalar && ((_a = a.message) === null || _a === void 0 ? void 0 : _a.typeName) === ((_b = b.message) === null || _b === void 0 ? void 0 : _b.typeName) && ((_c = a.enum) === null || _c === void 0 ? void 0 : _c.typeName) === ((_d = b.enum) === null || _d === void 0 ? void 0 : _d.typeName);
        }
        return !0;
      }
      return !1;
    }
    function isReflectMessage(arg, messageDesc3) {
      return isObject(arg) && unsafe_js_1.unsafeLocal in arg && "desc" in arg && isObject(arg.desc) && arg.desc.kind === "message" && (messageDesc3 === void 0 || arg.desc.typeName == messageDesc3.typeName);
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/wrappers.js
var require_wrappers = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/wrappers.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.isWrapper = isWrapper;
    exports.isWrapperDesc = isWrapperDesc;
    exports.hasCustomJsonRepresentation = hasCustomJsonRepresentation;
    function isWrapper(arg) {
      return isWrapperTypeName(arg.$typeName);
    }
    function isWrapperDesc(messageDesc3) {
      let f = messageDesc3.fields[0];
      return isWrapperTypeName(messageDesc3.typeName) && f !== void 0 && f.fieldKind == "scalar" && f.name == "value" && f.number == 1;
    }
    function hasCustomJsonRepresentation(desc) {
      switch (desc.typeName) {
        case "google.protobuf.Any":
        case "google.protobuf.Timestamp":
        case "google.protobuf.Duration":
        case "google.protobuf.FieldMask":
        case "google.protobuf.Struct":
        case "google.protobuf.Value":
        case "google.protobuf.ListValue":
          return !0;
        default:
          return isWrapperDesc(desc);
      }
    }
    var wrapperTypeNames = /* @__PURE__ */ new Set([
      "google.protobuf.DoubleValue",
      "google.protobuf.FloatValue",
      "google.protobuf.Int64Value",
      "google.protobuf.UInt64Value",
      "google.protobuf.Int32Value",
      "google.protobuf.UInt32Value",
      "google.protobuf.BoolValue",
      "google.protobuf.StringValue",
      "google.protobuf.BytesValue"
    ]);
    function isWrapperTypeName(name) {
      return wrapperTypeNames.has(name);
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/create.js
var require_create = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/create.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.create = create4;
    var is_message_js_1 = require_is_message(), descriptors_js_1 = require_descriptors(), scalar_js_1 = require_scalar(), guard_js_1 = require_guard(), wrappers_js_1 = require_wrappers(), EDITION_PROTO3 = 999, EDITION_PROTO2 = 998, IMPLICIT = 2;
    function create4(schema, init) {
      return (0, is_message_js_1.isMessage)(init, schema) ? init : compiledCreate(schema)(init);
    }
    var compiledCreates = /* @__PURE__ */ new WeakMap();
    function compiledCreate(desc) {
      let compiled = compiledCreates.get(desc);
      return compiled === void 0 && (compiled = compileCreate(desc), compiledCreates.set(desc, compiled)), compiled;
    }
    var INIT_SINGULAR = 0, INIT_LIST = 1, INIT_MAP = 2, INIT_ONEOF = 3;
    function compileCreate(desc) {
      let typeName = desc.typeName, { properties, prototype } = compileInitMessage(desc);
      return (init) => {
        let message;
        prototype !== void 0 ? (message = Object.create(prototype), message.$typeName = typeName) : message = { $typeName: typeName };
        for (let i = 0; i < properties.length; i++) {
          let property = properties[i], name = property.name, initValue = init?.[name];
          switch (property.kind) {
            case INIT_SINGULAR:
              initValue != null ? message[name] = property.convert !== void 0 ? property.convert(initValue) : initValue : property.constant !== void 0 && (message[name] = property.constant);
              break;
            case INIT_LIST:
              message[name] = property.convert !== void 0 && Array.isArray(initValue) ? initValue.map(property.convert) : initValue ?? [];
              break;
            case INIT_MAP:
              if (property.convert === void 0 || !(0, guard_js_1.isObject)(initValue))
                message[name] = initValue ?? {};
              else {
                let converted = {}, keys = Object.keys(initValue);
                for (let k = 0; k < keys.length; k++)
                  converted[keys[k]] = property.convert(initValue[keys[k]]);
                message[name] = converted;
              }
              break;
            case INIT_ONEOF: {
              let oneofValue = initValue;
              if (oneofValue?.case != null) {
                let convert = property.convert.get(oneofValue.case);
                if (convert !== void 0) {
                  message[name] = {
                    case: oneofValue.case,
                    value: convert(oneofValue.value)
                  };
                  break;
                }
              }
              message[name] = { case: void 0 };
              break;
            }
          }
        }
        return message;
      };
    }
    function compileInitMessage(desc) {
      var _a, _b;
      let properties = [], prototype = {}, usePrototype = needsPrototypeChain(desc);
      for (let member of desc.members) {
        let name = member.localName;
        if (member.kind == "oneof") {
          properties.push({
            name,
            kind: INIT_ONEOF,
            constant: void 0,
            convert: compileConvertOneof(member)
          });
          continue;
        }
        switch (member.fieldKind) {
          case "message": {
            properties.push({
              name,
              kind: INIT_SINGULAR,
              constant: void 0,
              convert: compileConvertMessage(member)
            });
            break;
          }
          case "list": {
            properties.push({
              name,
              kind: INIT_LIST,
              constant: void 0,
              convert: member.listKind == "message" ? (_a = compileConvertMessage(member)) !== null && _a !== void 0 ? _a : ((value) => value) : member.scalar == descriptors_js_1.ScalarType.BYTES ? toU8Arr : void 0
            });
            break;
          }
          case "map": {
            properties.push({
              name,
              kind: INIT_MAP,
              constant: void 0,
              convert: member.mapKind == "message" ? (_b = compileConvertMessage(member)) !== null && _b !== void 0 ? _b : ((value) => value) : member.scalar == descriptors_js_1.ScalarType.BYTES ? toU8Arr : void 0
            });
            break;
          }
          default: {
            let zeroValue = createZeroValue(member);
            properties.push({
              name,
              kind: INIT_SINGULAR,
              constant: member.presence == IMPLICIT ? zeroValue : void 0,
              convert: member.fieldKind == "scalar" && member.scalar == descriptors_js_1.ScalarType.BYTES ? toU8Arr : void 0
            }), usePrototype && (prototype[name] = zeroValue);
            break;
          }
        }
      }
      return {
        properties,
        prototype: usePrototype ? prototype : void 0
      };
    }
    function compileConvertOneof(oneof) {
      let converters = /* @__PURE__ */ new Map();
      for (let field of oneof.fields) {
        let convert;
        field.fieldKind == "message" ? convert = compileConvertMessage(field) : field.fieldKind == "scalar" && field.scalar == descriptors_js_1.ScalarType.BYTES && (convert = toU8Arr), converters.set(field.localName, convert ?? ((value) => value));
      }
      return converters;
    }
    function compileConvertMessage(field) {
      if (field.fieldKind == "message" && !field.oneof && (0, wrappers_js_1.isWrapperDesc)(field.message))
        return field.message.fields[0].scalar == descriptors_js_1.ScalarType.BYTES ? toU8Arr : void 0;
      if (field.message.typeName == "google.protobuf.Struct" && field.parent.typeName !== "google.protobuf.Value")
        return;
      let messageDesc3 = field.message, compiled;
      return (value) => !(0, guard_js_1.isObject)(value) || (0, is_message_js_1.isMessage)(value, messageDesc3) ? value : (compiled ?? (compiled = compiledCreate(messageDesc3)), compiled(value));
    }
    function toU8Arr(value) {
      return Array.isArray(value) ? new Uint8Array(value) : value;
    }
    function needsPrototypeChain(desc) {
      switch (desc.file.edition) {
        case EDITION_PROTO3:
          return !1;
        case EDITION_PROTO2:
          return !0;
        default:
          return desc.fields.some((f) => f.presence != IMPLICIT && f.fieldKind != "message" && !f.oneof);
      }
    }
    function createZeroValue(field) {
      let defaultValue = field.getDefaultValue();
      return defaultValue !== void 0 ? field.fieldKind == "scalar" && field.longAsString ? defaultValue.toString() : defaultValue : field.fieldKind == "scalar" ? (0, scalar_js_1.scalarZeroValue)(field.scalar, field.longAsString) : field.enum.values[0].number;
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/error.js
var require_error = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.FieldError = void 0;
    exports.isFieldError = isFieldError;
    var errorNames = [
      "FieldValueInvalidError",
      "FieldListRangeError",
      "ForeignFieldError"
    ], FieldError = class extends Error {
      constructor(fieldOrOneof, message, name = "FieldValueInvalidError") {
        super(message), this.name = name, this.field = () => fieldOrOneof;
      }
    };
    exports.FieldError = FieldError;
    function isFieldError(arg) {
      return arg instanceof Error && errorNames.includes(arg.name) && "field" in arg && typeof arg.field == "function";
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wire/text-encoding.js
var require_text_encoding = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wire/text-encoding.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.configureTextEncoding = configureTextEncoding;
    exports.getTextEncoding = getTextEncoding;
    exports.emulateEncodeInto = emulateEncodeInto;
    var symbol = /* @__PURE__ */ Symbol.for("@bufbuild/protobuf/text-encoding");
    function configureTextEncoding(textEncoding) {
      var _a;
      globalThis[symbol] = Object.assign(Object.assign({}, textEncoding), { encodeUtf8Into: (_a = textEncoding.encodeUtf8Into) !== null && _a !== void 0 ? _a : emulateEncodeInto(textEncoding.encodeUtf8.bind(textEncoding)) });
    }
    function getTextEncoding() {
      let globals = globalThis;
      if (!globals[symbol]) {
        let textEncoder = new globals.TextEncoder(), textDecoder = new globals.TextDecoder(), textDecoderStrict, config = {
          encodeUtf8(text) {
            return textEncoder.encode(text);
          },
          decodeUtf8(bytes, strict) {
            return strict ? (textDecoderStrict || (textDecoderStrict = new globals.TextDecoder("utf-8", {
              fatal: !0
            })), textDecoderStrict.decode(bytes)) : textDecoder.decode(bytes);
          },
          checkUtf8(text) {
            try {
              return encodeURIComponent(text), !0;
            } catch {
              return !1;
            }
          }
        };
        textEncoder.encodeInto && (config.encodeUtf8Into = textEncoder.encodeInto.bind(textEncoder));
        let nativeStringIsWellFormed = String.prototype.isWellFormed;
        nativeStringIsWellFormed && (config.checkUtf8 = (text) => nativeStringIsWellFormed.call(text)), configureTextEncoding(config);
      }
      return globals[symbol];
    }
    function emulateEncodeInto(encodeUtf8) {
      return (text, dest) => {
        let bytes = encodeUtf8(text);
        return dest.set(bytes), { written: bytes.byteLength };
      };
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wire/binary-encoding.js
var require_binary_encoding = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wire/binary-encoding.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.BinaryReader = exports.BinaryWriter = exports.INT32_MIN = exports.INT32_MAX = exports.UINT32_MAX = exports.FLOAT32_MIN = exports.FLOAT32_MAX = exports.WireType = void 0;
    var varint_js_1 = require_varint(), proto_int64_js_1 = require_proto_int64(), text_encoding_js_1 = require_text_encoding(), WireType;
    (function(WireType2) {
      WireType2[WireType2.Varint = 0] = "Varint", WireType2[WireType2.Bit64 = 1] = "Bit64", WireType2[WireType2.LengthDelimited = 2] = "LengthDelimited", WireType2[WireType2.StartGroup = 3] = "StartGroup", WireType2[WireType2.EndGroup = 4] = "EndGroup", WireType2[WireType2.Bit32 = 5] = "Bit32";
    })(WireType || (exports.WireType = WireType = {}));
    exports.FLOAT32_MAX = 34028234663852886e22;
    exports.FLOAT32_MIN = -34028234663852886e22;
    exports.UINT32_MAX = 4294967295;
    exports.INT32_MAX = 2147483647;
    exports.INT32_MIN = -2147483648;
    var BinaryWriter = class {
      constructor(encodeUtf8) {
        this.stackPos = [], this.encodeUtf8Into = encodeUtf8 ? (0, text_encoding_js_1.emulateEncodeInto)(encodeUtf8) : (0, text_encoding_js_1.getTextEncoding)().encodeUtf8Into, this.buffer = EMPTY_BUFFER, this.viewCache = EMPTY_VIEW, this.pos = 0;
      }
      ensureCapacity(size) {
        let required = this.pos + size;
        if (required > this.buffer.length) {
          let newLen = this.buffer.length || INITIAL_SIZE;
          for (; newLen < required; )
            newLen *= 2;
          let newBuf = new Uint8Array(newLen);
          this.pos > 0 && newBuf.set(this.buffer), this.buffer = newBuf;
        }
      }
      /**
       * The DataView over `buffer`, rebuilt only if the buffer has grown since it
       * was last used.
       */
      view() {
        let bytes = this.buffer, view = this.viewCache;
        if (view.byteLength === bytes.byteLength)
          return view;
        let newView = new DataView(bytes.buffer);
        return this.viewCache = newView, newView;
      }
      /**
       * Return all bytes written and reset this writer.
       */
      finish() {
        let result = this.buffer.slice(0, this.pos);
        return this.pos = 0, this.stackPos = [], result;
      }
      /**
       * Start a new fork for length-delimited data like a message
       * or a packed repeated field.
       *
       * Must be joined later with `join()`.
       */
      fork() {
        return this.stackPos.push(this.pos), this.ensureCapacity(DEFAULT_LEN_PREFIX_SIZE), this.buffer[this.pos++] = 0, this;
      }
      /**
       * Join the last fork. Write its length and bytes, then
       * return to the previous state.
       */
      join() {
        let forkPos = this.stackPos.pop();
        if (forkPos === void 0)
          throw new Error("invalid state, fork stack empty");
        let len = this.pos - forkPos - DEFAULT_LEN_PREFIX_SIZE, lenPrefixSize = varint32Size(len);
        return lenPrefixSize > DEFAULT_LEN_PREFIX_SIZE && (this.ensureCapacity(lenPrefixSize - DEFAULT_LEN_PREFIX_SIZE), this.buffer.copyWithin(forkPos + lenPrefixSize, forkPos + DEFAULT_LEN_PREFIX_SIZE, this.pos)), this.pos = forkPos, this.uint32(len), this.pos += len, this;
      }
      /**
       * Writes a tag (field number and wire type).
       *
       * Equivalent to `uint32( (fieldNo << 3 | type) >>> 0 )`.
       *
       * Generated code should compute the tag ahead of time and call `uint32()`.
       */
      tag(fieldNo, type) {
        return this.uint32((fieldNo << 3 | type) >>> 0);
      }
      /**
       * Write a chunk of raw bytes.
       */
      raw(chunk) {
        return this.ensureCapacity(chunk.length), this.buffer.set(chunk, this.pos), this.pos += chunk.length, this;
      }
      /**
       * Write a `uint32` value, an unsigned 32 bit varint.
       */
      uint32(value) {
        if (assertUInt32(value), this.ensureCapacity(5), value < 128)
          return this.buffer[this.pos++] = value, this;
        for (; value > 127; )
          this.buffer[this.pos++] = value & 127 | 128, value >>>= 7;
        return this.buffer[this.pos++] = value, this;
      }
      /**
       * Write a `int32` value, a signed 32 bit varint.
       */
      int32(value) {
        if (assertInt32(value), value >= 0)
          return this.uint32(value);
        this.ensureCapacity(10);
        for (let i = 0; i < 9; i++)
          this.buffer[this.pos++] = value & 127 | 128, value >>= 7;
        return this.buffer[this.pos++] = 1, this;
      }
      /**
       * Write a `bool` value, a varint.
       */
      bool(value) {
        return this.ensureCapacity(1), this.buffer[this.pos++] = value ? 1 : 0, this;
      }
      /**
       * Write a `bytes` value, length-delimited arbitrary data.
       */
      bytes(value) {
        return this.uint32(value.byteLength), this.raw(value);
      }
      /**
       * Write a `string` value, length-delimited data converted to UTF-8 text.
       */
      string(value) {
        typeof value != "string" && (value = String(value));
        let len = value.length;
        if (len <= ASCII_MAX_LENGTH) {
          this.ensureCapacity(len + 1);
          let ascii = this.buffer, pos = this.pos;
          ascii[pos++] = len;
          let i = 0;
          for (; i < len; i++) {
            let code = value.charCodeAt(i);
            if (code > 127)
              break;
            ascii[pos++] = code;
          }
          if (i == len)
            return this.pos = pos, this;
        }
        this.ensureCapacity(len * 3 + 5);
        let lenPrefixSizeGuess = varint32Size(len), buf = this.buffer, start = this.pos, { written } = this.encodeUtf8Into(value, buf.subarray(start + lenPrefixSizeGuess)), lenPrefixSize = varint32Size(written);
        return lenPrefixSize != lenPrefixSizeGuess && buf.copyWithin(start + lenPrefixSize, start + lenPrefixSizeGuess, start + lenPrefixSizeGuess + written), this.uint32(written), this.pos += written, this;
      }
      /**
       * Write a `float` value, 32-bit floating point number.
       */
      float(value) {
        return assertFloat32(value), this.ensureCapacity(4), this.view().setFloat32(this.pos, value, !0), this.pos += 4, this;
      }
      /**
       * Write a `double` value, a 64-bit floating point number.
       */
      double(value) {
        return this.ensureCapacity(8), this.view().setFloat64(this.pos, value, !0), this.pos += 8, this;
      }
      /**
       * Write a `fixed32` value, an unsigned, fixed-length 32-bit integer.
       */
      fixed32(value) {
        return assertUInt32(value), this.ensureCapacity(4), this.view().setUint32(this.pos, value, !0), this.pos += 4, this;
      }
      /**
       * Write a `sfixed32` value, a signed, fixed-length 32-bit integer.
       */
      sfixed32(value) {
        return assertInt32(value), this.ensureCapacity(4), this.view().setInt32(this.pos, value, !0), this.pos += 4, this;
      }
      /**
       * Write a `sint32` value, a signed, zigzag-encoded 32-bit varint.
       */
      sint32(value) {
        return assertInt32(value), this.uint32((value << 1 ^ value >> 31) >>> 0);
      }
      /**
       * Write a `sfixed64` value, a signed, fixed-length 64-bit integer.
       */
      sfixed64(value) {
        let tc = proto_int64_js_1.protoInt64.enc(value);
        this.ensureCapacity(8);
        let view = this.view();
        return view.setInt32(this.pos, tc.lo, !0), view.setInt32(this.pos + 4, tc.hi, !0), this.pos += 8, this;
      }
      /**
       * Write a `fixed64` value, an unsigned, fixed-length 64 bit integer.
       */
      fixed64(value) {
        let tc = proto_int64_js_1.protoInt64.uEnc(value);
        this.ensureCapacity(8);
        let view = this.view();
        return view.setInt32(this.pos, tc.lo, !0), view.setInt32(this.pos + 4, tc.hi, !0), this.pos += 8, this;
      }
      /**
       * Write a `int64` value, a signed 64-bit varint.
       */
      int64(value) {
        let tc = proto_int64_js_1.protoInt64.enc(value);
        return this.writeVarint64(tc.lo, tc.hi);
      }
      /**
       * Write a `sint64` value, a signed, zig-zag-encoded 64-bit varint.
       */
      sint64(value) {
        let tc = proto_int64_js_1.protoInt64.enc(value), sign = tc.hi >> 31, lo = tc.lo << 1 ^ sign, hi = (tc.hi << 1 | tc.lo >>> 31) ^ sign;
        return this.writeVarint64(lo, hi);
      }
      /**
       * Write a `uint64` value, an unsigned 64-bit varint.
       */
      uint64(value) {
        let tc = proto_int64_js_1.protoInt64.uEnc(value);
        return this.writeVarint64(tc.lo, tc.hi);
      }
      /**
       * Write a 64-bit varint directly into the buffer. Accepts the value as
       * split low/high 32-bit words.
       *
       * Ported from varint64write() to avoid the intermediate number[] buffer.
       * See https://github.com/protocolbuffers/protobuf/blob/8a71927d74a4ce34efe2d8769fda198f52d20d12/js/experimental/runtime/kernel/writer.js#L344
       */
      writeVarint64(lo, hi) {
        this.ensureCapacity(10);
        let buf = this.buffer, pos = this.pos;
        for (let i = 0; i < 28; i = i + 7) {
          let shift = lo >>> i, hasNext = !(!(shift >>> 7) && hi == 0);
          if (buf[pos++] = (hasNext ? shift | 128 : shift) & 255, !hasNext)
            return this.pos = pos, this;
        }
        let splitBits = lo >>> 28 & 15 | (hi & 7) << 4, hasMoreBits = hi >> 3 != 0;
        if (buf[pos++] = (hasMoreBits ? splitBits | 128 : splitBits) & 255, !hasMoreBits)
          return this.pos = pos, this;
        for (let i = 3; i < 31; i = i + 7) {
          let shift = hi >>> i, hasNext = !!(shift >>> 7);
          if (buf[pos++] = (hasNext ? shift | 128 : shift) & 255, !hasNext)
            return this.pos = pos, this;
        }
        return buf[pos++] = hi >>> 31 & 1, this.pos = pos, this;
      }
    };
    exports.BinaryWriter = BinaryWriter;
    var INITIAL_SIZE = 128, DEFAULT_LEN_PREFIX_SIZE = 1, EMPTY_BUFFER = new Uint8Array(0), EMPTY_VIEW = new DataView(EMPTY_BUFFER.buffer), ASCII_MAX_LENGTH = 32;
    function varint32Size(value) {
      return value < 128 ? 1 : value < 16384 ? 2 : value < 2097152 ? 3 : value < 268435456 ? 4 : 5;
    }
    var BinaryReader = class {
      constructor(buf, decodeUtf8 = (0, text_encoding_js_1.getTextEncoding)().decodeUtf8) {
        this.decodeUtf8 = decodeUtf8, this.varint64Lo = 0, this.varint64Hi = 0, this.varint64 = varint_js_1.varint64read, this.uint32 = varint_js_1.varint32read, this.buf = buf, this.len = buf.length, this.pos = 0, this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      }
      /**
       * Reads a tag - field number and wire type. Tags are uint32 varints; values
       * that do not fit in uint32 are rejected.
       */
      tag() {
        let start = this.pos, tag = this.uint32(), bytesRead = this.pos - start;
        if (bytesRead > 5 || bytesRead == 5 && this.buf[this.pos - 1] > 15)
          throw new Error("illegal tag: varint overflows uint32");
        let fieldNo = tag >>> 3, wireType = tag & 7;
        if (fieldNo <= 0 || wireType > 5)
          throw new Error("illegal tag: field no " + fieldNo + " wire type " + wireType);
        return [fieldNo, wireType];
      }
      /**
       * Skip one element and return the skipped data.
       *
       * When skipping StartGroup, provide the tags field number to check for
       * matching field number in the EndGroup tag. Recursion into nested groups
       * is guarded by the `recursionLimit` argument: When the limit is reached,
       * this method throws.
       */
      skip(wireType, fieldNo, recursionLimit = 100) {
        let start = this.pos;
        switch (wireType) {
          case WireType.Varint:
            for (; this.buf[this.pos++] & 128; )
              ;
            break;
          // @ts-ignore TS7029: Fallthrough case in switch -- ignore instead of expect-error for compiler settings without noFallthroughCasesInSwitch: true
          case WireType.Bit64:
            this.pos += 4;
          case WireType.Bit32:
            this.pos += 4;
            break;
          case WireType.LengthDelimited:
            let len = this.uint32();
            this.pos += len;
            break;
          case WireType.StartGroup:
            if (recursionLimit <= 0)
              throw new Error("maximum recursion depth reached");
            for (; ; ) {
              let [fn, wt] = this.tag();
              if (wt === WireType.EndGroup) {
                if (fieldNo !== void 0 && fn !== fieldNo)
                  throw new Error("invalid end group tag");
                break;
              }
              this.skip(wt, fn, recursionLimit - 1);
            }
            break;
          default:
            throw new Error("cant skip wire type " + wireType);
        }
        return this.assertBounds(), this.buf.subarray(start, this.pos);
      }
      /**
       * Throws error if position in byte array is out of range.
       */
      assertBounds() {
        if (this.pos > this.len)
          throw new RangeError("premature EOF");
      }
      /**
       * Read a `int32` field, a signed 32 bit varint.
       */
      int32() {
        return this.uint32() | 0;
      }
      /**
       * Read a `sint32` field, a signed, zigzag-encoded 32-bit varint.
       */
      sint32() {
        let zze = this.uint32();
        return zze >>> 1 ^ -(zze & 1);
      }
      /**
       * Read a `int64` field, a signed 64-bit varint.
       */
      int64() {
        return this.varint64(), proto_int64_js_1.protoInt64.dec(this.varint64Lo, this.varint64Hi);
      }
      /**
       * Read a `uint64` field, an unsigned 64-bit varint.
       */
      uint64() {
        return this.varint64(), proto_int64_js_1.protoInt64.uDec(this.varint64Lo, this.varint64Hi);
      }
      /**
       * Read a `sint64` field, a signed, zig-zag-encoded 64-bit varint.
       */
      sint64() {
        this.varint64();
        let lo = this.varint64Lo, hi = this.varint64Hi, s = -(lo & 1);
        return lo = (lo >>> 1 | (hi & 1) << 31) ^ s, hi = hi >>> 1 ^ s, proto_int64_js_1.protoInt64.dec(lo, hi);
      }
      /**
       * Read a `bool` field, a variant.
       */
      bool() {
        let b = this.buf[this.pos];
        return b < 128 ? (this.pos++, b !== 0) : (this.varint64(), this.varint64Lo !== 0 || this.varint64Hi !== 0);
      }
      /**
       * Read a `fixed32` field, an unsigned, fixed-length 32-bit integer.
       */
      fixed32() {
        return this.view.getUint32((this.pos += 4) - 4, !0);
      }
      /**
       * Read a `sfixed32` field, a signed, fixed-length 32-bit integer.
       */
      sfixed32() {
        return this.view.getInt32((this.pos += 4) - 4, !0);
      }
      /**
       * Read a `fixed64` field, an unsigned, fixed-length 64 bit integer.
       */
      fixed64() {
        return proto_int64_js_1.protoInt64.uDec(this.sfixed32(), this.sfixed32());
      }
      /**
       * Read a `fixed64` field, a signed, fixed-length 64-bit integer.
       */
      sfixed64() {
        return proto_int64_js_1.protoInt64.dec(this.sfixed32(), this.sfixed32());
      }
      /**
       * Read a `float` field, 32-bit floating point number.
       */
      float() {
        return this.view.getFloat32((this.pos += 4) - 4, !0);
      }
      /**
       * Read a `double` field, a 64-bit floating point number.
       */
      double() {
        return this.view.getFloat64((this.pos += 8) - 8, !0);
      }
      /**
       * Read a `bytes` field, length-delimited arbitrary data.
       */
      bytes() {
        let len = this.uint32(), start = this.pos;
        return this.pos += len, this.assertBounds(), this.buf.subarray(start, start + len);
      }
      /**
       * Read a `string` field, length-delimited data converted to UTF-8 text. If
       * `strict` is true, throw on invalid UTF-8 instead of substituting U+FFFD.
       */
      string(strict) {
        let bytes = this.bytes(), len = bytes.length;
        if (len <= ASCII_MAX_LENGTH) {
          let codes = new Array(len);
          for (let i = 0; i < len; i++) {
            let byte = bytes[i];
            if (byte > 127)
              return this.decodeUtf8(bytes, strict);
            codes[i] = byte;
          }
          return String.fromCharCode.apply(String, codes);
        }
        return this.decodeUtf8(bytes, strict);
      }
    };
    exports.BinaryReader = BinaryReader;
    function assertInt32(arg) {
      if (typeof arg == "string")
        arg = Number(arg);
      else if (typeof arg != "number")
        throw new Error("invalid int32: " + typeof arg);
      if (!Number.isInteger(arg) || arg > exports.INT32_MAX || arg < exports.INT32_MIN)
        throw new Error("invalid int32: " + arg);
    }
    function assertUInt32(arg) {
      if (typeof arg == "string")
        arg = Number(arg);
      else if (typeof arg != "number")
        throw new Error("invalid uint32: " + typeof arg);
      if (!Number.isInteger(arg) || arg > exports.UINT32_MAX || arg < 0)
        throw new Error("invalid uint32: " + arg);
    }
    function assertFloat32(arg) {
      if (typeof arg == "string") {
        let o = arg;
        if (arg = Number(arg), Number.isNaN(arg) && o !== "NaN")
          throw new Error("invalid float32: " + o);
      } else if (typeof arg != "number")
        throw new Error("invalid float32: " + typeof arg);
      if (Number.isFinite(arg) && (arg > exports.FLOAT32_MAX || arg < exports.FLOAT32_MIN))
        throw new Error("invalid float32: " + arg);
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/reflect-check.js
var require_reflect_check = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/reflect-check.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.checkField = checkField;
    exports.checkListItem = checkListItem;
    exports.checkMapEntry = checkMapEntry;
    exports.checkScalarValue = checkScalarValue;
    exports.reasonSingular = reasonSingular;
    exports.formatVal = formatVal;
    var descriptors_js_1 = require_descriptors(), is_message_js_1 = require_is_message(), error_js_1 = require_error(), guard_js_1 = require_guard(), binary_encoding_js_1 = require_binary_encoding(), text_encoding_js_1 = require_text_encoding(), proto_int64_js_1 = require_proto_int64();
    function checkField(field, value) {
      let check = field.fieldKind == "list" ? (0, guard_js_1.isReflectList)(value, field) : field.fieldKind == "map" ? (0, guard_js_1.isReflectMap)(value, field) : checkSingular(field, value);
      if (check === !0)
        return;
      let reason;
      switch (field.fieldKind) {
        case "list":
          reason = `expected ${formatReflectList(field)}, got ${formatVal(value)}`;
          break;
        case "map":
          reason = `expected ${formatReflectMap(field)}, got ${formatVal(value)}`;
          break;
        default:
          reason = reasonSingular(field, value, check);
      }
      return new error_js_1.FieldError(field, reason);
    }
    function checkListItem(field, index, value) {
      let check = checkSingular(field, value);
      if (check !== !0)
        return new error_js_1.FieldError(field, `list item #${index + 1}: ${reasonSingular(field, value, check)}`);
    }
    function checkMapEntry(field, key, value) {
      let checkKey = checkScalarValue(field.mapKey)(key);
      if (checkKey !== !0)
        return new error_js_1.FieldError(field, `invalid map key: ${reasonSingular({ scalar: field.mapKey }, key, checkKey)}`);
      let checkVal = checkSingular(field, value);
      if (checkVal !== !0)
        return new error_js_1.FieldError(field, `map entry ${formatVal(key)}: ${reasonSingular(field, value, checkVal)}`);
    }
    function checkSingular(field, value) {
      return field.scalar !== void 0 ? checkScalarValue(field.scalar)(value) : field.enum !== void 0 ? field.enum.open ? checkScalarValue(descriptors_js_1.ScalarType.INT32)(value) : field.enum.values.some((v) => v.number === value) : (0, guard_js_1.isReflectMessage)(value, field.message);
    }
    function checkScalarValue(scalar) {
      switch (scalar) {
        case descriptors_js_1.ScalarType.DOUBLE:
          return (value) => typeof value == "number";
        case descriptors_js_1.ScalarType.FLOAT:
          return (value) => typeof value != "number" ? !1 : Number.isNaN(value) || !Number.isFinite(value) ? !0 : value > binary_encoding_js_1.FLOAT32_MAX || value < binary_encoding_js_1.FLOAT32_MIN ? `${value.toFixed()} out of range` : !0;
        case descriptors_js_1.ScalarType.INT32:
        case descriptors_js_1.ScalarType.SFIXED32:
        case descriptors_js_1.ScalarType.SINT32:
          return (value) => typeof value != "number" || !Number.isInteger(value) ? !1 : value > binary_encoding_js_1.INT32_MAX || value < binary_encoding_js_1.INT32_MIN ? `${value.toFixed()} out of range` : !0;
        case descriptors_js_1.ScalarType.FIXED32:
        case descriptors_js_1.ScalarType.UINT32:
          return (value) => typeof value != "number" || !Number.isInteger(value) ? !1 : value > binary_encoding_js_1.UINT32_MAX || value < 0 ? `${value.toFixed()} out of range` : !0;
        case descriptors_js_1.ScalarType.BOOL:
          return (value) => typeof value == "boolean";
        case descriptors_js_1.ScalarType.STRING:
          return (value) => typeof value != "string" ? !1 : (0, text_encoding_js_1.getTextEncoding)().checkUtf8(value) || "invalid UTF8";
        case descriptors_js_1.ScalarType.BYTES:
          return (value) => value instanceof Uint8Array;
        case descriptors_js_1.ScalarType.INT64:
        case descriptors_js_1.ScalarType.SFIXED64:
        case descriptors_js_1.ScalarType.SINT64:
          return (value) => {
            if (typeof value == "bigint" || typeof value == "number" || typeof value == "string" && value.length > 0)
              try {
                return proto_int64_js_1.protoInt64.parse(value), !0;
              } catch {
                return `${value} out of range`;
              }
            return !1;
          };
        case descriptors_js_1.ScalarType.FIXED64:
        case descriptors_js_1.ScalarType.UINT64:
          return (value) => {
            if (typeof value == "bigint" || typeof value == "number" || typeof value == "string" && value.length > 0)
              try {
                return proto_int64_js_1.protoInt64.uParse(value), !0;
              } catch {
                return `${value} out of range`;
              }
            return !1;
          };
      }
    }
    function reasonSingular(field, val, details) {
      return details = typeof details == "string" ? `: ${details}` : `, got ${formatVal(val)}`, field.scalar !== void 0 ? `expected ${scalarTypeDescription(field.scalar)}` + details : field.enum !== void 0 ? `expected ${field.enum.toString()}` + details : `expected ${formatReflectMessage(field.message)}` + details;
    }
    function formatVal(val) {
      switch (typeof val) {
        case "object":
          return val === null ? "null" : val instanceof Uint8Array ? `Uint8Array(${val.length})` : Array.isArray(val) ? `Array(${val.length})` : (0, guard_js_1.isReflectList)(val) ? formatReflectList(val.field()) : (0, guard_js_1.isReflectMap)(val) ? formatReflectMap(val.field()) : (0, guard_js_1.isReflectMessage)(val) ? formatReflectMessage(val.desc) : (0, is_message_js_1.isMessage)(val) ? `message ${val.$typeName}` : "object";
        case "string":
          return val.length > 30 ? "string" : `"${val.split('"').join('\\"')}"`;
        case "boolean":
          return String(val);
        case "number":
          return String(val);
        case "bigint":
          return String(val) + "n";
        default:
          return typeof val;
      }
    }
    function formatReflectMessage(desc) {
      return `ReflectMessage (${desc.typeName})`;
    }
    function formatReflectList(field) {
      switch (field.listKind) {
        case "message":
          return `ReflectList (${field.message.toString()})`;
        case "enum":
          return `ReflectList (${field.enum.toString()})`;
        case "scalar":
          return `ReflectList (${descriptors_js_1.ScalarType[field.scalar]})`;
      }
    }
    function formatReflectMap(field) {
      switch (field.mapKind) {
        case "message":
          return `ReflectMap (${descriptors_js_1.ScalarType[field.mapKey]}, ${field.message.toString()})`;
        case "enum":
          return `ReflectMap (${descriptors_js_1.ScalarType[field.mapKey]}, ${field.enum.toString()})`;
        case "scalar":
          return `ReflectMap (${descriptors_js_1.ScalarType[field.mapKey]}, ${descriptors_js_1.ScalarType[field.scalar]})`;
      }
    }
    function scalarTypeDescription(scalar) {
      switch (scalar) {
        case descriptors_js_1.ScalarType.STRING:
          return "string";
        case descriptors_js_1.ScalarType.BOOL:
          return "boolean";
        case descriptors_js_1.ScalarType.INT64:
        case descriptors_js_1.ScalarType.SINT64:
        case descriptors_js_1.ScalarType.SFIXED64:
          return "bigint (int64)";
        case descriptors_js_1.ScalarType.UINT64:
        case descriptors_js_1.ScalarType.FIXED64:
          return "bigint (uint64)";
        case descriptors_js_1.ScalarType.BYTES:
          return "Uint8Array";
        case descriptors_js_1.ScalarType.DOUBLE:
          return "number (float64)";
        case descriptors_js_1.ScalarType.FLOAT:
          return "number (float32)";
        case descriptors_js_1.ScalarType.FIXED32:
        case descriptors_js_1.ScalarType.UINT32:
          return "number (uint32)";
        case descriptors_js_1.ScalarType.INT32:
        case descriptors_js_1.ScalarType.SFIXED32:
        case descriptors_js_1.ScalarType.SINT32:
          return "number (int32)";
      }
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/message.js
var require_message = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/message.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.localMessageMapper = localMessageMapper;
    exports.wktStructToReflect = wktStructToReflect;
    exports.wktStructToLocal = wktStructToLocal;
    var create_js_1 = require_create(), guard_js_1 = require_guard(), wrappers_js_1 = require_wrappers(), NULL_VALUE = 0;
    function localMessageMapper(field) {
      if (usesJsonRepresentation(field))
        return {
          toMessage: (local) => wktStructToReflect(local),
          toLocal: (message) => wktStructToLocal(message)
        };
      if (field.fieldKind == "message" && !field.oneof && (0, wrappers_js_1.isWrapperDesc)(field.message)) {
        let wrapperDesc = field.message, valueLocalName = wrapperDesc.fields[0].localName;
        return {
          toMessage: (local) => {
            let message = (0, create_js_1.create)(wrapperDesc);
            return local !== void 0 && (message[valueLocalName] = local), message;
          },
          toLocal: (message) => message[valueLocalName]
        };
      }
      let childDesc = field.message;
      return {
        toMessage: (local) => local === void 0 ? (0, create_js_1.create)(childDesc) : local,
        toLocal: (message) => message
      };
    }
    function usesJsonRepresentation(field) {
      return field.message.typeName == "google.protobuf.Struct" && field.parent.typeName != "google.protobuf.Value";
    }
    function wktStructToReflect(json) {
      let struct = {
        $typeName: "google.protobuf.Struct",
        fields: {}
      };
      if ((0, guard_js_1.isObject)(json))
        for (let k of Object.keys(json))
          struct.fields[k] = wktValueToReflect(json[k]);
      return struct;
    }
    function wktStructToLocal(val) {
      let json = {};
      for (let k of Object.keys(val.fields))
        json[k] = wktValueToLocal(val.fields[k]);
      return json;
    }
    function wktValueToLocal(val) {
      switch (val.kind.case) {
        case "structValue":
          return wktStructToLocal(val.kind.value);
        case "listValue":
          return val.kind.value.values.map(wktValueToLocal);
        case "nullValue":
        case void 0:
          return null;
        default:
          return val.kind.value;
      }
    }
    function wktValueToReflect(json) {
      let value = {
        $typeName: "google.protobuf.Value",
        kind: { case: void 0 }
      };
      switch (typeof json) {
        case "number":
          value.kind = { case: "numberValue", value: json };
          break;
        case "string":
          value.kind = { case: "stringValue", value: json };
          break;
        case "boolean":
          value.kind = { case: "boolValue", value: json };
          break;
        case "object":
          if (json === null)
            value.kind = { case: "nullValue", value: NULL_VALUE };
          else if (Array.isArray(json)) {
            let listValue = {
              $typeName: "google.protobuf.ListValue",
              values: []
            };
            if (Array.isArray(json))
              for (let e of json)
                listValue.values.push(wktValueToReflect(e));
            value.kind = {
              case: "listValue",
              value: listValue
            };
          } else
            value.kind = {
              case: "structValue",
              value: wktStructToReflect(json)
            };
          break;
      }
      return value;
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/reflect.js
var require_reflect = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/reflect.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.reflect = reflect;
    exports.reflectList = reflectList;
    exports.reflectMap = reflectMap;
    var descriptors_js_1 = require_descriptors(), reflect_check_js_1 = require_reflect_check(), error_js_1 = require_error(), unsafe_js_1 = require_unsafe(), create_js_1 = require_create(), wrappers_js_1 = require_wrappers(), scalar_js_1 = require_scalar(), proto_int64_js_1 = require_proto_int64(), guard_js_1 = require_guard(), message_js_1 = require_message();
    function reflect(messageDesc3, message, check = !0) {
      return new ReflectMessageImpl(messageDesc3, message, check);
    }
    var messageSortedFields = /* @__PURE__ */ new WeakMap(), ReflectMessageImpl = class {
      get sortedFields() {
        let cached = messageSortedFields.get(this.desc);
        if (cached)
          return cached;
        let sortedFields = this.desc.fields.concat().sort((a, b) => a.number - b.number);
        return messageSortedFields.set(this.desc, sortedFields), sortedFields;
      }
      constructor(messageDesc3, message, check = !0) {
        this.lists = /* @__PURE__ */ new Map(), this.maps = /* @__PURE__ */ new Map(), this.check = check, this.desc = messageDesc3, this.message = this[unsafe_js_1.unsafeLocal] = message ?? (0, create_js_1.create)(messageDesc3), this.fields = messageDesc3.fields, this.oneofs = messageDesc3.oneofs, this.members = messageDesc3.members;
      }
      findNumber(number) {
        return this._fieldsByNumber || (this._fieldsByNumber = new Map(this.desc.fields.map((f) => [f.number, f]))), this._fieldsByNumber.get(number);
      }
      oneofCase(oneof) {
        return assertOwn(this.message, oneof), (0, unsafe_js_1.unsafeOneofCase)(this.message, oneof);
      }
      isSet(field) {
        return assertOwn(this.message, field), (0, unsafe_js_1.unsafeIsSet)(this.message, field);
      }
      clear(field) {
        assertOwn(this.message, field), (0, unsafe_js_1.unsafeClear)(this.message, field);
      }
      get(field) {
        assertOwn(this.message, field);
        let value = (0, unsafe_js_1.unsafeGet)(this.message, field);
        switch (field.fieldKind) {
          case "list":
            let list = this.lists.get(field);
            return (!list || list[unsafe_js_1.unsafeLocal] !== value) && this.lists.set(
              field,
              // biome-ignore lint/suspicious/noAssignInExpressions: no
              list = new ReflectListImpl(field, value, this.check)
            ), list;
          case "map":
            let map = this.maps.get(field);
            return (!map || map[unsafe_js_1.unsafeLocal] !== value) && this.maps.set(
              field,
              // biome-ignore lint/suspicious/noAssignInExpressions: no
              map = new ReflectMapImpl(field, value, this.check)
            ), map;
          case "message":
            return messageToReflect(field, value, this.check);
          case "scalar":
            return value === void 0 ? (0, scalar_js_1.scalarZeroValue)(field.scalar, !1) : longToReflect(field, value);
          case "enum":
            return value ?? field.enum.values[0].number;
        }
      }
      set(field, value) {
        if (assertOwn(this.message, field), this.check) {
          let err = (0, reflect_check_js_1.checkField)(field, value);
          if (err)
            throw err;
        }
        let local;
        field.fieldKind == "message" ? local = messageToLocal(field, value) : (0, guard_js_1.isReflectMap)(value) || (0, guard_js_1.isReflectList)(value) ? local = value[unsafe_js_1.unsafeLocal] : local = longToLocal(field, value), (0, unsafe_js_1.unsafeSet)(this.message, field, local);
      }
      getUnknown() {
        return this.message.$unknown;
      }
      setUnknown(value) {
        this.message.$unknown = value;
      }
    };
    function assertOwn(owner, member) {
      if (member.parent.typeName !== owner.$typeName)
        throw new error_js_1.FieldError(member, `cannot use ${member.toString()} with message ${owner.$typeName}`, "ForeignFieldError");
    }
    function reflectList(field, unsafeInput, check = !0) {
      return new ReflectListImpl(field, unsafeInput ?? [], check);
    }
    var ReflectListImpl = class {
      field() {
        return this._field;
      }
      get size() {
        return this._arr.length;
      }
      constructor(field, unsafeInput, check) {
        this._field = field, this._arr = this[unsafe_js_1.unsafeLocal] = unsafeInput, this.check = check;
      }
      get(index) {
        let item = this._arr[index];
        return item === void 0 ? void 0 : listItemToReflect(this._field, item, this.check);
      }
      set(index, item) {
        if (index < 0 || index >= this._arr.length)
          throw new error_js_1.FieldError(this._field, `list item #${index + 1}: out of range`);
        if (this.check) {
          let err = (0, reflect_check_js_1.checkListItem)(this._field, index, item);
          if (err)
            throw err;
        }
        this._arr[index] = listItemToLocal(this._field, item);
      }
      add(item) {
        if (this.check) {
          let err = (0, reflect_check_js_1.checkListItem)(this._field, this._arr.length, item);
          if (err)
            throw err;
        }
        this._arr.push(listItemToLocal(this._field, item));
      }
      clear() {
        this._arr.splice(0, this._arr.length);
      }
      [Symbol.iterator]() {
        return this.values();
      }
      keys() {
        return this._arr.keys();
      }
      *values() {
        for (let item of this._arr)
          yield listItemToReflect(this._field, item, this.check);
      }
      *entries() {
        for (let i = 0; i < this._arr.length; i++)
          yield [i, listItemToReflect(this._field, this._arr[i], this.check)];
      }
    };
    function reflectMap(field, unsafeInput, check = !0) {
      return new ReflectMapImpl(field, unsafeInput, check);
    }
    var ReflectMapImpl = class {
      constructor(field, unsafeInput, check = !0) {
        this.obj = this[unsafe_js_1.unsafeLocal] = unsafeInput ?? {}, this.check = check, this._field = field;
      }
      field() {
        return this._field;
      }
      set(key, value) {
        if (this.check) {
          let err = (0, reflect_check_js_1.checkMapEntry)(this._field, key, value);
          if (err)
            throw err;
        }
        return this.obj[mapKeyToLocal(key)] = mapValueToLocal(this._field, value), this;
      }
      delete(key) {
        let k = mapKeyToLocal(key), has = Object.prototype.hasOwnProperty.call(this.obj, k);
        return has && delete this.obj[k], has;
      }
      clear() {
        for (let key of Object.keys(this.obj))
          delete this.obj[key];
      }
      get(key) {
        let val = this.obj[mapKeyToLocal(key)];
        return val !== void 0 && (val = mapValueToReflect(this._field, val, this.check)), val;
      }
      has(key) {
        return Object.prototype.hasOwnProperty.call(this.obj, mapKeyToLocal(key));
      }
      *keys() {
        for (let objKey of Object.keys(this.obj))
          yield mapKeyToReflect(objKey, this._field.mapKey);
      }
      *entries() {
        for (let objEntry of Object.entries(this.obj))
          yield [
            mapKeyToReflect(objEntry[0], this._field.mapKey),
            mapValueToReflect(this._field, objEntry[1], this.check)
          ];
      }
      [Symbol.iterator]() {
        return this.entries();
      }
      get size() {
        return Object.keys(this.obj).length;
      }
      *values() {
        for (let val of Object.values(this.obj))
          yield mapValueToReflect(this._field, val, this.check);
      }
      forEach(callbackfn, thisArg) {
        for (let mapEntry of this.entries())
          callbackfn.call(thisArg, mapEntry[1], mapEntry[0], this);
      }
    };
    function messageToLocal(field, value) {
      return (0, guard_js_1.isReflectMessage)(value) ? (0, wrappers_js_1.isWrapper)(value.message) && !field.oneof && field.fieldKind == "message" ? value.message.value : value.desc.typeName == "google.protobuf.Struct" && field.parent.typeName != "google.protobuf.Value" ? (0, message_js_1.wktStructToLocal)(value.message) : value.message : value;
    }
    function messageToReflect(field, value, check) {
      return value !== void 0 && ((0, wrappers_js_1.isWrapperDesc)(field.message) && !field.oneof && field.fieldKind == "message" ? value = {
        $typeName: field.message.typeName,
        value: longToReflect(field.message.fields[0], value)
      } : field.message.typeName == "google.protobuf.Struct" && field.parent.typeName != "google.protobuf.Value" && (0, guard_js_1.isObject)(value) && (value = (0, message_js_1.wktStructToReflect)(value))), new ReflectMessageImpl(field.message, value, check);
    }
    function listItemToLocal(field, value) {
      return field.listKind == "message" ? messageToLocal(field, value) : longToLocal(field, value);
    }
    function listItemToReflect(field, value, check) {
      return field.listKind == "message" ? messageToReflect(field, value, check) : longToReflect(field, value);
    }
    function mapValueToLocal(field, value) {
      return field.mapKind == "message" ? messageToLocal(field, value) : longToLocal(field, value);
    }
    function mapValueToReflect(field, value, check) {
      return field.mapKind == "message" ? messageToReflect(field, value, check) : value;
    }
    function mapKeyToLocal(key) {
      return typeof key == "string" || typeof key == "number" ? key : String(key);
    }
    function mapKeyToReflect(key, type) {
      switch (type) {
        case descriptors_js_1.ScalarType.STRING:
          return key;
        case descriptors_js_1.ScalarType.INT32:
        case descriptors_js_1.ScalarType.FIXED32:
        case descriptors_js_1.ScalarType.UINT32:
        case descriptors_js_1.ScalarType.SFIXED32:
        case descriptors_js_1.ScalarType.SINT32: {
          let n = Number.parseInt(key);
          if (Number.isFinite(n))
            return n;
          break;
        }
        case descriptors_js_1.ScalarType.BOOL:
          switch (key) {
            case "true":
              return !0;
            case "false":
              return !1;
          }
          break;
        case descriptors_js_1.ScalarType.UINT64:
        case descriptors_js_1.ScalarType.FIXED64:
          try {
            return proto_int64_js_1.protoInt64.uParse(key);
          } catch {
          }
          break;
        default:
          try {
            return proto_int64_js_1.protoInt64.parse(key);
          } catch {
          }
          break;
      }
      return key;
    }
    function longToReflect(field, value) {
      switch (field.scalar) {
        case descriptors_js_1.ScalarType.INT64:
        case descriptors_js_1.ScalarType.SFIXED64:
        case descriptors_js_1.ScalarType.SINT64:
          "longAsString" in field && field.longAsString && typeof value == "string" && (value = proto_int64_js_1.protoInt64.parse(value));
          break;
        case descriptors_js_1.ScalarType.FIXED64:
        case descriptors_js_1.ScalarType.UINT64:
          "longAsString" in field && field.longAsString && typeof value == "string" && (value = proto_int64_js_1.protoInt64.uParse(value));
          break;
      }
      return value;
    }
    function longToLocal(field, value) {
      switch (field.scalar) {
        case descriptors_js_1.ScalarType.INT64:
        case descriptors_js_1.ScalarType.SFIXED64:
        case descriptors_js_1.ScalarType.SINT64:
          "longAsString" in field && field.longAsString ? value = String(value) : (typeof value == "string" || typeof value == "number") && (value = proto_int64_js_1.protoInt64.parse(value));
          break;
        case descriptors_js_1.ScalarType.FIXED64:
        case descriptors_js_1.ScalarType.UINT64:
          "longAsString" in field && field.longAsString ? value = String(value) : (typeof value == "string" || typeof value == "number") && (value = proto_int64_js_1.protoInt64.uParse(value));
          break;
      }
      return value;
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/clone.js
var require_clone = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/clone.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.clone = clone;
    var descriptors_js_1 = require_descriptors(), reflect_js_1 = require_reflect(), guard_js_1 = require_guard();
    function clone(schema, message) {
      return cloneReflect((0, reflect_js_1.reflect)(schema, message)).message;
    }
    function cloneReflect(i) {
      let o = (0, reflect_js_1.reflect)(i.desc);
      for (let f of i.fields)
        if (i.isSet(f))
          switch (f.fieldKind) {
            case "list":
              let list = o.get(f);
              for (let item of i.get(f))
                list.add(cloneSingular(f, item));
              break;
            case "map":
              let map = o.get(f);
              for (let entry of i.get(f).entries())
                map.set(entry[0], cloneSingular(f, entry[1]));
              break;
            default: {
              o.set(f, cloneSingular(f, i.get(f)));
              break;
            }
          }
      let unknown = i.getUnknown();
      return unknown && unknown.length > 0 && o.setUnknown([...unknown]), o;
    }
    function cloneSingular(field, value) {
      return field.message !== void 0 && (0, guard_js_1.isReflectMessage)(value) ? cloneReflect(value) : field.scalar == descriptors_js_1.ScalarType.BYTES && value instanceof Uint8Array ? value.slice() : value;
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wire/base64-encoding.js
var require_base64_encoding = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wire/base64-encoding.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.base64Decode = base64Decode;
    exports.base64Encode = base64Encode;
    var nativeSetFromBase64 = Uint8Array.prototype.setFromBase64;
    function base64Decode(base64Str) {
      let len = base64Str.length, size = len - (len + 3 >> 2);
      (len & 3) == 0 && base64Str[len - 1] == "=" && (size -= base64Str[len - 2] == "=" ? 2 : 1);
      let bytes = new Uint8Array(size), written = -1;
      if (nativeSetFromBase64)
        try {
          let result = nativeSetFromBase64.call(bytes, base64Str);
          result.read == len && (written = result.written);
        } catch {
        }
      return written < 0 && (written = setFromBase64(bytes, base64Str)), written == size ? bytes : bytes.subarray(0, written);
    }
    function setFromBase64(bytes, base64Str) {
      let table = getDecodeTable(), bytePos = 0, groupPos = 0, b, p = 0;
      for (let i = 0; i < base64Str.length; i++) {
        if (b = table[base64Str.charCodeAt(i)], b === void 0)
          switch (base64Str[i]) {
            // @ts-ignore TS7029: Fallthrough case in switch -- ignore instead of expect-error for compiler settings without noFallthroughCasesInSwitch: true
            case "=":
              groupPos = 0;
            // reset state when padding found
            case `
`:
            case "\r":
            case "	":
            case " ":
              continue;
            // skip white-space, and padding
            default:
              throw Error("invalid base64 string");
          }
        switch (groupPos) {
          case 0:
            p = b, groupPos = 1;
            break;
          case 1:
            bytes[bytePos++] = p << 2 | (b & 48) >> 4, p = b, groupPos = 2;
            break;
          case 2:
            bytes[bytePos++] = (p & 15) << 4 | (b & 60) >> 2, p = b, groupPos = 3;
            break;
          case 3:
            bytes[bytePos++] = (p & 3) << 6 | b, groupPos = 0;
            break;
        }
      }
      if (groupPos == 1)
        throw Error("invalid base64 string");
      return bytePos;
    }
    var nativeToBase64 = Uint8Array.prototype.toBase64, toBase64OptionsMap = {
      std: { alphabet: "base64", omitPadding: !1 },
      std_raw: { alphabet: "base64", omitPadding: !0 },
      url: { alphabet: "base64url", omitPadding: !0 }
    };
    function base64Encode(bytes, encoding = "std") {
      if (nativeToBase64)
        return nativeToBase64.call(bytes, toBase64OptionsMap[encoding]);
      let table = getEncodeTable(encoding), pad = encoding == "std", base64 = "", groupPos = 0, b, p = 0;
      for (let i = 0; i < bytes.length; i++)
        switch (b = bytes[i], groupPos) {
          case 0:
            base64 += table[b >> 2], p = (b & 3) << 4, groupPos = 1;
            break;
          case 1:
            base64 += table[p | b >> 4], p = (b & 15) << 2, groupPos = 2;
            break;
          case 2:
            base64 += table[p | b >> 6], base64 += table[b & 63], groupPos = 0;
            break;
        }
      return groupPos && (base64 += table[p], pad && (base64 += "=", groupPos == 1 && (base64 += "="))), base64;
    }
    var encodeTableStd, encodeTableUrl, decodeTable;
    function getEncodeTable(encoding) {
      return encodeTableStd || (encodeTableStd = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split(""), encodeTableUrl = encodeTableStd.slice(0, -2).concat("-", "_")), encoding == "url" ? (
        // biome-ignore lint/style/noNonNullAssertion: TS fails to narrow down
        encodeTableUrl
      ) : encodeTableStd;
    }
    function getDecodeTable() {
      if (!decodeTable) {
        decodeTable = [];
        let encodeTable = getEncodeTable("std");
        for (let i = 0; i < encodeTable.length; i++)
          decodeTable[encodeTable[i].charCodeAt(0)] = i;
        decodeTable[45] = encodeTable.indexOf("+"), decodeTable[95] = encodeTable.indexOf("/");
      }
      return decodeTable;
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/names.js
var require_names = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/names.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.qualifiedName = qualifiedName;
    exports.protoCamelCase = protoCamelCase;
    exports.protoSnakeCase = protoSnakeCase;
    exports.safeObjectProperty = safeObjectProperty;
    function qualifiedName(desc) {
      switch (desc.kind) {
        case "field":
        case "oneof":
        case "rpc":
          return desc.parent.typeName + "." + desc.name;
        case "enum_value": {
          let p = desc.parent.parent ? desc.parent.parent.typeName : desc.parent.file.proto.package;
          return p + (p.length > 0 ? "." : "") + desc.name;
        }
        case "service":
        case "message":
        case "enum":
        case "extension":
          return desc.typeName;
        case "file":
          return desc.proto.name;
      }
    }
    function protoCamelCase(snakeCase) {
      let capNext = !1, b = [];
      for (let i = 0; i < snakeCase.length; i++) {
        let c = snakeCase.charAt(i);
        switch (c) {
          case "_":
            capNext = !0;
            break;
          case "0":
          case "1":
          case "2":
          case "3":
          case "4":
          case "5":
          case "6":
          case "7":
          case "8":
          case "9":
            b.push(c), capNext = !1;
            break;
          default:
            capNext && (capNext = !1, c = c.toUpperCase()), b.push(c);
            break;
        }
      }
      return b.join("");
    }
    function protoSnakeCase(lowerCamelCase) {
      return lowerCamelCase.replace(/[A-Z]/g, (letter) => "_" + letter.toLowerCase());
    }
    var reservedObjectProperties = /* @__PURE__ */ new Set([
      // names reserved by JavaScript
      "constructor",
      "toString",
      "toJSON",
      "valueOf"
    ]);
    function safeObjectProperty(name) {
      return reservedObjectProperties.has(name) ? name + "$" : name;
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/restore-json-names.js
var require_restore_json_names = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/restore-json-names.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.restoreJsonNames = restoreJsonNames;
    var names_js_1 = require_names(), unsafe_js_1 = require_unsafe();
    function restoreJsonNames(message) {
      for (let f of message.field)
        (0, unsafe_js_1.unsafeIsSetExplicit)(f, "jsonName") || (f.jsonName = (0, names_js_1.protoCamelCase)(f.name));
      message.nestedType.forEach(restoreJsonNames);
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wire/text-format.js
var require_text_format = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wire/text-format.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.parseTextFormatEnumValue = parseTextFormatEnumValue;
    exports.parseTextFormatScalarValue = parseTextFormatScalarValue;
    var descriptors_js_1 = require_descriptors(), proto_int64_js_1 = require_proto_int64();
    function parseTextFormatEnumValue(descEnum, value) {
      let enumValue = descEnum.values.find((v) => v.name === value);
      if (!enumValue)
        throw new Error(`cannot parse ${descEnum} default value: ${value}`);
      return enumValue.number;
    }
    function parseTextFormatScalarValue(type, value) {
      switch (type) {
        case descriptors_js_1.ScalarType.STRING:
          return value;
        case descriptors_js_1.ScalarType.BYTES: {
          let u = unescapeBytesDefaultValue(value);
          if (u === !1)
            throw new Error(`cannot parse ${descriptors_js_1.ScalarType[type]} default value: ${value}`);
          return u;
        }
        case descriptors_js_1.ScalarType.INT64:
        case descriptors_js_1.ScalarType.SFIXED64:
        case descriptors_js_1.ScalarType.SINT64:
          return proto_int64_js_1.protoInt64.parse(value);
        case descriptors_js_1.ScalarType.UINT64:
        case descriptors_js_1.ScalarType.FIXED64:
          return proto_int64_js_1.protoInt64.uParse(value);
        case descriptors_js_1.ScalarType.DOUBLE:
        case descriptors_js_1.ScalarType.FLOAT:
          switch (value) {
            case "inf":
              return Number.POSITIVE_INFINITY;
            case "-inf":
              return Number.NEGATIVE_INFINITY;
            case "nan":
              return Number.NaN;
            default:
              return parseFloat(value);
          }
        case descriptors_js_1.ScalarType.BOOL:
          return value === "true";
        case descriptors_js_1.ScalarType.INT32:
        case descriptors_js_1.ScalarType.UINT32:
        case descriptors_js_1.ScalarType.SINT32:
        case descriptors_js_1.ScalarType.FIXED32:
        case descriptors_js_1.ScalarType.SFIXED32:
          return parseInt(value, 10);
      }
    }
    function unescapeBytesDefaultValue(str) {
      let b = [], input = {
        tail: str,
        c: "",
        next() {
          return this.tail.length == 0 ? !1 : (this.c = this.tail[0], this.tail = this.tail.substring(1), !0);
        },
        take(n) {
          if (this.tail.length >= n) {
            let r = this.tail.substring(0, n);
            return this.tail = this.tail.substring(n), r;
          }
          return !1;
        }
      };
      for (; input.next(); )
        switch (input.c) {
          case "\\":
            if (input.next())
              switch (input.c) {
                case "\\":
                  b.push(input.c.charCodeAt(0));
                  break;
                case "b":
                  b.push(8);
                  break;
                case "f":
                  b.push(12);
                  break;
                case "n":
                  b.push(10);
                  break;
                case "r":
                  b.push(13);
                  break;
                case "t":
                  b.push(9);
                  break;
                case "v":
                  b.push(11);
                  break;
                case "0":
                case "1":
                case "2":
                case "3":
                case "4":
                case "5":
                case "6":
                case "7": {
                  let s = input.c, t = input.take(2);
                  if (t === !1)
                    return !1;
                  let n = parseInt(s + t, 8);
                  if (Number.isNaN(n))
                    return !1;
                  b.push(n);
                  break;
                }
                case "x": {
                  let s = input.c, t = input.take(2);
                  if (t === !1)
                    return !1;
                  let n = parseInt(s + t, 16);
                  if (Number.isNaN(n))
                    return !1;
                  b.push(n);
                  break;
                }
                case "u": {
                  let s = input.c, t = input.take(4);
                  if (t === !1)
                    return !1;
                  let n = parseInt(s + t, 16);
                  if (Number.isNaN(n))
                    return !1;
                  let chunk = new Uint8Array(4);
                  new DataView(chunk.buffer).setInt32(0, n, !0), b.push(chunk[0], chunk[1], chunk[2], chunk[3]);
                  break;
                }
                case "U": {
                  let s = input.c, t = input.take(8);
                  if (t === !1)
                    return !1;
                  let tc = proto_int64_js_1.protoInt64.uEnc(s + t), chunk = new Uint8Array(8), view = new DataView(chunk.buffer);
                  view.setInt32(0, tc.lo, !0), view.setInt32(4, tc.hi, !0), b.push(chunk[0], chunk[1], chunk[2], chunk[3], chunk[4], chunk[5], chunk[6], chunk[7]);
                  break;
                }
              }
            break;
          default:
            b.push(input.c.charCodeAt(0));
        }
      return new Uint8Array(b);
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/nested-types.js
var require_nested_types = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/reflect/nested-types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.nestedTypes = nestedTypes;
    exports.usedTypes = usedTypes;
    exports.parentTypes = parentTypes;
    function* nestedTypes(desc) {
      switch (desc.kind) {
        case "file":
          for (let message of desc.messages)
            yield message, yield* nestedTypes(message);
          yield* desc.enums, yield* desc.services, yield* desc.extensions;
          break;
        case "message":
          for (let message of desc.nestedMessages)
            yield message, yield* nestedTypes(message);
          yield* desc.nestedEnums, yield* desc.nestedExtensions;
          break;
      }
    }
    function usedTypes(descMessage) {
      return usedTypesInternal(descMessage, /* @__PURE__ */ new Set());
    }
    function* usedTypesInternal(descMessage, seen) {
      var _a, _b;
      for (let field of descMessage.fields) {
        let ref = (_b = (_a = field.enum) !== null && _a !== void 0 ? _a : field.message) !== null && _b !== void 0 ? _b : void 0;
        !ref || seen.has(ref.typeName) || (seen.add(ref.typeName), yield ref, ref.kind == "message" && (yield* usedTypesInternal(ref, seen)));
      }
    }
    function parentTypes(desc) {
      let parents = [];
      for (; desc.kind !== "file"; ) {
        let p = parent(desc);
        desc = p, parents.push(p);
      }
      return parents;
    }
    function parent(desc) {
      var _a;
      switch (desc.kind) {
        case "enum_value":
        case "field":
        case "oneof":
        case "rpc":
          return desc.parent;
        case "service":
          return desc.file;
        case "extension":
        case "enum":
        case "message":
          return (_a = desc.parent) !== null && _a !== void 0 ? _a : desc.file;
      }
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/registry.js
var require_registry = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/registry.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.maximumEdition = exports.minimumEdition = void 0;
    exports.createRegistry = createRegistry;
    exports.createMutableRegistry = createMutableRegistry;
    exports.createFileRegistry = createFileRegistry;
    var descriptors_js_1 = require_descriptors(), text_format_js_1 = require_text_format(), nested_types_js_1 = require_nested_types(), unsafe_js_1 = require_unsafe(), names_js_1 = require_names();
    function createRegistry(...input) {
      return initBaseRegistry(input);
    }
    function createMutableRegistry(...input) {
      let reg = initBaseRegistry(input);
      return Object.assign(Object.assign({}, reg), { remove(desc) {
        var _a;
        desc.kind == "extension" && ((_a = reg.extendees.get(desc.extendee.typeName)) === null || _a === void 0 || _a.delete(desc.number)), reg.types.delete(desc.typeName);
      } });
    }
    function createFileRegistry(...args) {
      let registry = createBaseRegistry();
      if (!args.length)
        return registry;
      if ("$typeName" in args[0] && args[0].$typeName == "google.protobuf.FileDescriptorSet") {
        for (let file of args[0].file)
          addFile(file, registry);
        return registry;
      }
      if ("$typeName" in args[0]) {
        let recurseDeps = function(file) {
          let deps = [];
          for (let protoFileName of file.dependency) {
            if (registry.getFile(protoFileName) != null || seen.has(protoFileName))
              continue;
            let dep = resolve(protoFileName);
            if (!dep)
              throw new Error(`Unable to resolve ${protoFileName}, imported by ${file.name}`);
            "kind" in dep ? registry.addFile(dep, !1, !0) : (seen.add(dep.name), deps.push(dep));
          }
          return deps.concat(...deps.map(recurseDeps));
        }, input = args[0], resolve = args[1], seen = /* @__PURE__ */ new Set();
        for (let file of [input, ...recurseDeps(input)].reverse())
          addFile(file, registry);
      } else
        for (let fileReg of args)
          for (let file of fileReg.files)
            registry.addFile(file);
      return registry;
    }
    function createBaseRegistry() {
      let types = /* @__PURE__ */ new Map(), extendees = /* @__PURE__ */ new Map(), files = /* @__PURE__ */ new Map();
      return {
        kind: "registry",
        types,
        extendees,
        [Symbol.iterator]() {
          return types.values();
        },
        get files() {
          return files.values();
        },
        addFile(file, skipTypes, withDeps) {
          if (files.set(file.proto.name, file), !skipTypes)
            for (let type of (0, nested_types_js_1.nestedTypes)(file))
              this.add(type);
          if (withDeps)
            for (let f of file.dependencies)
              this.addFile(f, skipTypes, withDeps);
        },
        add(desc) {
          if (desc.kind == "extension") {
            let numberToExt = extendees.get(desc.extendee.typeName);
            numberToExt || extendees.set(
              desc.extendee.typeName,
              // biome-ignore lint/suspicious/noAssignInExpressions: no
              numberToExt = /* @__PURE__ */ new Map()
            ), numberToExt.set(desc.number, desc);
          }
          types.set(desc.typeName, desc);
        },
        get(typeName) {
          return types.get(typeName);
        },
        getFile(fileName) {
          return files.get(fileName);
        },
        getMessage(typeName) {
          let t = types.get(typeName);
          return t?.kind == "message" ? t : void 0;
        },
        getEnum(typeName) {
          let t = types.get(typeName);
          return t?.kind == "enum" ? t : void 0;
        },
        getExtension(typeName) {
          let t = types.get(typeName);
          return t?.kind == "extension" ? t : void 0;
        },
        getExtensionFor(extendee, no) {
          var _a;
          return (_a = extendees.get(extendee.typeName)) === null || _a === void 0 ? void 0 : _a.get(no);
        },
        getService(typeName) {
          let t = types.get(typeName);
          return t?.kind == "service" ? t : void 0;
        }
      };
    }
    function initBaseRegistry(inputs) {
      let registry = createBaseRegistry();
      for (let input of inputs)
        switch (input.kind) {
          case "registry":
            for (let n of input)
              registry.add(n);
            break;
          case "file":
            registry.addFile(input);
            break;
          default:
            registry.add(input);
            break;
        }
      return registry;
    }
    var EDITION_PROTO2 = 998, EDITION_PROTO3 = 999, EDITION_UNSTABLE = 9999, TYPE_STRING = 9, TYPE_GROUP = 10, TYPE_MESSAGE = 11, TYPE_BYTES = 12, TYPE_ENUM = 14, LABEL_REPEATED = 3, LABEL_REQUIRED = 2, JS_STRING = 1, IDEMPOTENCY_UNKNOWN = 0, EXPLICIT = 1, IMPLICIT = 2, LEGACY_REQUIRED = 3, PACKED = 1, DELIMITED = 2, OPEN = 1, VERIFY = 2;
    exports.minimumEdition = 998, exports.maximumEdition = 1001;
    var featureDefaults = {
      // EDITION_PROTO2
      998: {
        fieldPresence: 1,
        // EXPLICIT,
        enumType: 2,
        // CLOSED,
        repeatedFieldEncoding: 2,
        // EXPANDED,
        utf8Validation: 3,
        // NONE,
        messageEncoding: 1,
        // LENGTH_PREFIXED,
        jsonFormat: 2,
        // LEGACY_BEST_EFFORT,
        enforceNamingStyle: 2,
        // STYLE_LEGACY,
        defaultSymbolVisibility: 1
        // EXPORT_ALL,
      },
      // EDITION_PROTO3
      999: {
        fieldPresence: 2,
        // IMPLICIT,
        enumType: 1,
        // OPEN,
        repeatedFieldEncoding: 1,
        // PACKED,
        utf8Validation: 2,
        // VERIFY,
        messageEncoding: 1,
        // LENGTH_PREFIXED,
        jsonFormat: 1,
        // ALLOW,
        enforceNamingStyle: 2,
        // STYLE_LEGACY,
        defaultSymbolVisibility: 1
        // EXPORT_ALL,
      },
      // EDITION_2023
      1e3: {
        fieldPresence: 1,
        // EXPLICIT,
        enumType: 1,
        // OPEN,
        repeatedFieldEncoding: 1,
        // PACKED,
        utf8Validation: 2,
        // VERIFY,
        messageEncoding: 1,
        // LENGTH_PREFIXED,
        jsonFormat: 1,
        // ALLOW,
        enforceNamingStyle: 2,
        // STYLE_LEGACY,
        defaultSymbolVisibility: 1
        // EXPORT_ALL,
      },
      // EDITION_2024
      1001: {
        fieldPresence: 1,
        // EXPLICIT,
        enumType: 1,
        // OPEN,
        repeatedFieldEncoding: 1,
        // PACKED,
        utf8Validation: 2,
        // VERIFY,
        messageEncoding: 1,
        // LENGTH_PREFIXED,
        jsonFormat: 1,
        // ALLOW,
        enforceNamingStyle: 1,
        // STYLE2024,
        defaultSymbolVisibility: 2
        // EXPORT_TOP_LEVEL,
      }
    };
    function addFile(proto, reg) {
      var _a, _b;
      let file = {
        kind: "file",
        proto,
        deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
        edition: getFileEdition(proto),
        name: proto.name.replace(/\.proto$/, ""),
        dependencies: findFileDependencies(proto, reg),
        enums: [],
        messages: [],
        extensions: [],
        services: [],
        toString() {
          return `file ${proto.name}`;
        }
      }, mapEntriesStore = /* @__PURE__ */ new Map(), mapEntries = {
        get(typeName) {
          return mapEntriesStore.get(typeName);
        },
        add(desc) {
          var _a2;
          assert2(((_a2 = desc.proto.options) === null || _a2 === void 0 ? void 0 : _a2.mapEntry) === !0), mapEntriesStore.set(desc.typeName, desc);
        }
      };
      for (let enumProto of proto.enumType)
        addEnum(enumProto, file, void 0, reg);
      for (let messageProto of proto.messageType)
        addMessage(messageProto, file, void 0, reg, mapEntries);
      for (let serviceProto of proto.service)
        addService(serviceProto, file, reg);
      addExtensions(file, reg);
      for (let mapEntry of mapEntriesStore.values())
        addFields(mapEntry, reg, mapEntries);
      for (let message of file.messages)
        addFields(message, reg, mapEntries), addExtensions(message, reg);
      reg.addFile(file, !0);
    }
    function addExtensions(desc, reg) {
      switch (desc.kind) {
        case "file":
          for (let proto of desc.proto.extension) {
            let ext = newField(proto, desc, reg);
            desc.extensions.push(ext), reg.add(ext);
          }
          break;
        case "message":
          for (let proto of desc.proto.extension) {
            let ext = newField(proto, desc, reg);
            desc.nestedExtensions.push(ext), reg.add(ext);
          }
          for (let message of desc.nestedMessages)
            addExtensions(message, reg);
          break;
      }
    }
    function addFields(message, reg, mapEntries) {
      let allOneofs = message.proto.oneofDecl.map((proto) => newOneof(proto, message)), oneofsSeen = /* @__PURE__ */ new Set();
      for (let proto of message.proto.field) {
        let oneof = findOneof(proto, allOneofs), field = newField(proto, message, reg, oneof, mapEntries);
        message.fields.push(field), message.field[field.localName] = field, oneof === void 0 ? message.members.push(field) : (oneof.fields.push(field), oneofsSeen.has(oneof) || (oneofsSeen.add(oneof), message.members.push(oneof)));
      }
      for (let oneof of allOneofs.filter((o) => oneofsSeen.has(o)))
        message.oneofs.push(oneof);
      for (let child of message.nestedMessages)
        addFields(child, reg, mapEntries);
    }
    function addEnum(proto, file, parent, reg) {
      var _a, _b, _c, _d, _e;
      let sharedPrefix = findEnumSharedPrefix(proto.name, proto.value), desc = {
        kind: "enum",
        proto,
        deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
        file,
        parent,
        open: !0,
        name: proto.name,
        typeName: makeTypeName(proto, parent, file),
        value: {},
        values: [],
        sharedPrefix,
        toString() {
          return `enum ${this.typeName}`;
        }
      };
      desc.open = isEnumOpen(desc), reg.add(desc);
      for (let p of proto.value) {
        let name = p.name;
        desc.values.push(
          // biome-ignore lint/suspicious/noAssignInExpressions: no
          desc.value[p.number] = {
            kind: "enum_value",
            proto: p,
            deprecated: (_d = (_c = p.options) === null || _c === void 0 ? void 0 : _c.deprecated) !== null && _d !== void 0 ? _d : !1,
            parent: desc,
            name,
            localName: (0, names_js_1.safeObjectProperty)(sharedPrefix == null ? name : name.substring(sharedPrefix.length)),
            number: p.number,
            toString() {
              return `enum value ${desc.typeName}.${name}`;
            }
          }
        );
      }
      ((_e = parent?.nestedEnums) !== null && _e !== void 0 ? _e : file.enums).push(desc);
    }
    function addMessage(proto, file, parent, reg, mapEntries) {
      var _a, _b, _c, _d;
      let desc = {
        kind: "message",
        proto,
        deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
        file,
        parent,
        name: proto.name,
        typeName: makeTypeName(proto, parent, file),
        fields: [],
        field: {},
        oneofs: [],
        members: [],
        nestedEnums: [],
        nestedMessages: [],
        nestedExtensions: [],
        toString() {
          return `message ${this.typeName}`;
        }
      };
      ((_c = proto.options) === null || _c === void 0 ? void 0 : _c.mapEntry) === !0 ? mapEntries.add(desc) : (((_d = parent?.nestedMessages) !== null && _d !== void 0 ? _d : file.messages).push(desc), reg.add(desc));
      for (let enumProto of proto.enumType)
        addEnum(enumProto, file, desc, reg);
      for (let messageProto of proto.nestedType)
        addMessage(messageProto, file, desc, reg, mapEntries);
    }
    function addService(proto, file, reg) {
      var _a, _b;
      let desc = {
        kind: "service",
        proto,
        deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
        file,
        name: proto.name,
        typeName: makeTypeName(proto, void 0, file),
        methods: [],
        method: {},
        toString() {
          return `service ${this.typeName}`;
        }
      };
      file.services.push(desc), reg.add(desc);
      for (let methodProto of proto.method) {
        let method = newMethod(methodProto, desc, reg);
        desc.methods.push(method), desc.method[method.localName] = method;
      }
    }
    function newMethod(proto, parent, reg) {
      var _a, _b, _c, _d;
      let methodKind;
      proto.clientStreaming && proto.serverStreaming ? methodKind = "bidi_streaming" : proto.clientStreaming ? methodKind = "client_streaming" : proto.serverStreaming ? methodKind = "server_streaming" : methodKind = "unary";
      let input = reg.getMessage(trimLeadingDot(proto.inputType)), output = reg.getMessage(trimLeadingDot(proto.outputType));
      assert2(input, `invalid MethodDescriptorProto: input_type ${proto.inputType} not found`), assert2(output, `invalid MethodDescriptorProto: output_type ${proto.inputType} not found`);
      let name = proto.name;
      return {
        kind: "rpc",
        proto,
        deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
        parent,
        name,
        localName: (0, names_js_1.safeObjectProperty)(name.length ? (0, names_js_1.safeObjectProperty)(name[0].toLowerCase() + name.substring(1)) : name),
        methodKind,
        input,
        output,
        idempotency: (_d = (_c = proto.options) === null || _c === void 0 ? void 0 : _c.idempotencyLevel) !== null && _d !== void 0 ? _d : IDEMPOTENCY_UNKNOWN,
        toString() {
          return `rpc ${parent.typeName}.${name}`;
        }
      };
    }
    function newOneof(proto, parent) {
      return {
        kind: "oneof",
        proto,
        deprecated: !1,
        parent,
        fields: [],
        name: proto.name,
        localName: (0, names_js_1.safeObjectProperty)((0, names_js_1.protoCamelCase)(proto.name)),
        toString() {
          return `oneof ${parent.typeName}.${this.name}`;
        }
      };
    }
    function newField(proto, parentOrFile, reg, oneof, mapEntries) {
      var _a, _b, _c;
      let isExtension = mapEntries === void 0, field = {
        kind: "field",
        proto,
        deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
        name: proto.name,
        number: proto.number,
        scalar: void 0,
        message: void 0,
        enum: void 0,
        presence: getFieldPresence(proto, oneof, isExtension, parentOrFile),
        utf8Validation: isUtf8Validated(proto, parentOrFile),
        listKind: void 0,
        mapKind: void 0,
        mapKey: void 0,
        delimitedEncoding: void 0,
        packed: void 0,
        longAsString: !1,
        getDefaultValue: void 0
      }, toStr;
      if (isExtension) {
        let file = parentOrFile.kind == "file" ? parentOrFile : parentOrFile.file, parent = parentOrFile.kind == "file" ? void 0 : parentOrFile, typeName = makeTypeName(proto, parent, file);
        field.kind = "extension", field.file = file, field.parent = parent, field.oneof = void 0, field.typeName = typeName, field.jsonName = `[${typeName}]`, toStr = () => `extension ${typeName}`;
        let extendee = reg.getMessage(trimLeadingDot(proto.extendee));
        assert2(extendee, `invalid FieldDescriptorProto: extendee ${proto.extendee} not found`), field.extendee = extendee;
      } else {
        let parent = parentOrFile;
        assert2(parent.kind == "message"), field.parent = parent, field.oneof = oneof, field.localName = oneof ? (0, names_js_1.protoCamelCase)(proto.name) : (0, names_js_1.safeObjectProperty)((0, names_js_1.protoCamelCase)(proto.name)), field.jsonName = proto.jsonName, toStr = () => `field ${parent.typeName}.${proto.name}`;
      }
      Object.defineProperty(field, "toString", {
        value: toStr,
        writable: !0,
        enumerable: !0,
        configurable: !0
      });
      let label = proto.label, type = proto.type, jstype = (_c = proto.options) === null || _c === void 0 ? void 0 : _c.jstype;
      if (label === LABEL_REPEATED) {
        let mapEntry = type == TYPE_MESSAGE ? mapEntries?.get(trimLeadingDot(proto.typeName)) : void 0;
        if (mapEntry) {
          field.fieldKind = "map";
          let { key, value } = findMapEntryFields(mapEntry);
          return field.mapKey = key.scalar, field.mapKind = value.fieldKind, field.message = value.message, field.delimitedEncoding = !1, field.enum = value.enum, field.scalar = value.scalar, field;
        }
        switch (field.fieldKind = "list", type) {
          case TYPE_MESSAGE:
          case TYPE_GROUP:
            field.listKind = "message", field.message = reg.getMessage(trimLeadingDot(proto.typeName)), assert2(field.message), field.delimitedEncoding = isDelimitedEncoding(proto, parentOrFile);
            break;
          case TYPE_ENUM:
            field.listKind = "enum", field.enum = reg.getEnum(trimLeadingDot(proto.typeName)), assert2(field.enum);
            break;
          default:
            field.listKind = "scalar", field.scalar = type, field.longAsString = jstype == JS_STRING;
            break;
        }
        return field.packed = isPackedField(proto, parentOrFile), field;
      }
      switch (type) {
        case TYPE_MESSAGE:
        case TYPE_GROUP:
          field.fieldKind = "message", field.message = reg.getMessage(trimLeadingDot(proto.typeName)), assert2(field.message, `invalid FieldDescriptorProto: type_name ${proto.typeName} not found`), field.delimitedEncoding = isDelimitedEncoding(proto, parentOrFile), field.getDefaultValue = () => {
          };
          break;
        case TYPE_ENUM: {
          let enumeration = reg.getEnum(trimLeadingDot(proto.typeName));
          assert2(enumeration !== void 0, `invalid FieldDescriptorProto: type_name ${proto.typeName} not found`), field.fieldKind = "enum", field.enum = reg.getEnum(trimLeadingDot(proto.typeName)), field.getDefaultValue = () => (0, unsafe_js_1.unsafeIsSetExplicit)(proto, "defaultValue") ? (0, text_format_js_1.parseTextFormatEnumValue)(enumeration, proto.defaultValue) : void 0;
          break;
        }
        default: {
          field.fieldKind = "scalar", field.scalar = type, field.longAsString = jstype == JS_STRING, field.getDefaultValue = () => (0, unsafe_js_1.unsafeIsSetExplicit)(proto, "defaultValue") ? (0, text_format_js_1.parseTextFormatScalarValue)(type, proto.defaultValue) : void 0;
          break;
        }
      }
      return field;
    }
    function getFileEdition(proto) {
      switch (proto.syntax) {
        case "":
        case "proto2":
          return EDITION_PROTO2;
        case "proto3":
          return EDITION_PROTO3;
        case "editions":
          if (proto.edition === EDITION_UNSTABLE)
            return exports.maximumEdition;
          if (proto.edition in featureDefaults)
            return proto.edition;
          throw new Error(`${proto.name}: unsupported edition`);
        default:
          throw new Error(`${proto.name}: unsupported syntax "${proto.syntax}"`);
      }
    }
    function findFileDependencies(proto, reg) {
      return proto.dependency.map((wantName) => {
        let dep = reg.getFile(wantName);
        if (!dep)
          throw new Error(`Cannot find ${wantName}, imported by ${proto.name}`);
        return dep;
      });
    }
    function findEnumSharedPrefix(enumName, values) {
      let prefix = camelToSnakeCase(enumName) + "_";
      for (let value of values) {
        if (!value.name.toLowerCase().startsWith(prefix))
          return;
        let shortName = value.name.substring(prefix.length);
        if (shortName.length == 0 || /^\d/.test(shortName))
          return;
      }
      return prefix;
    }
    function camelToSnakeCase(camel) {
      return (camel.substring(0, 1) + camel.substring(1).replace(/[A-Z]/g, (c) => "_" + c)).toLowerCase();
    }
    function makeTypeName(proto, parent, file) {
      let typeName;
      return parent ? typeName = `${parent.typeName}.${proto.name}` : file.proto.package.length > 0 ? typeName = `${file.proto.package}.${proto.name}` : typeName = `${proto.name}`, typeName;
    }
    function trimLeadingDot(typeName) {
      return typeName.startsWith(".") ? typeName.substring(1) : typeName;
    }
    function findOneof(proto, allOneofs) {
      if (!(0, unsafe_js_1.unsafeIsSetExplicit)(proto, "oneofIndex") || proto.proto3Optional)
        return;
      let oneof = allOneofs[proto.oneofIndex];
      return assert2(oneof, `invalid FieldDescriptorProto: oneof #${proto.oneofIndex} for field #${proto.number} not found`), oneof;
    }
    function getFieldPresence(proto, oneof, isExtension, parent) {
      if (proto.label == LABEL_REQUIRED)
        return LEGACY_REQUIRED;
      if (proto.label == LABEL_REPEATED)
        return IMPLICIT;
      if (oneof || proto.proto3Optional || isExtension)
        return EXPLICIT;
      let resolved = resolveFeature("fieldPresence", { proto, parent });
      return resolved == IMPLICIT && (proto.type == TYPE_MESSAGE || proto.type == TYPE_GROUP) ? EXPLICIT : resolved;
    }
    function isPackedField(proto, parent) {
      if (proto.label != LABEL_REPEATED)
        return !1;
      switch (proto.type) {
        case TYPE_STRING:
        case TYPE_BYTES:
        case TYPE_GROUP:
        case TYPE_MESSAGE:
          return !1;
      }
      let o = proto.options;
      return o && (0, unsafe_js_1.unsafeIsSetExplicit)(o, "packed") ? o.packed : PACKED == resolveFeature("repeatedFieldEncoding", {
        proto,
        parent
      });
    }
    function findMapEntryFields(mapEntry) {
      let key = mapEntry.fields.find((f) => f.number === 1), value = mapEntry.fields.find((f) => f.number === 2);
      return assert2(key && key.fieldKind == "scalar" && key.scalar != descriptors_js_1.ScalarType.BYTES && key.scalar != descriptors_js_1.ScalarType.FLOAT && key.scalar != descriptors_js_1.ScalarType.DOUBLE && value && value.fieldKind != "list" && value.fieldKind != "map"), { key, value };
    }
    function isEnumOpen(desc) {
      var _a;
      return OPEN == resolveFeature("enumType", {
        proto: desc.proto,
        parent: (_a = desc.parent) !== null && _a !== void 0 ? _a : desc.file
      });
    }
    function isDelimitedEncoding(proto, parent) {
      return proto.type == TYPE_GROUP ? !0 : DELIMITED == resolveFeature("messageEncoding", {
        proto,
        parent
      });
    }
    function isUtf8Validated(proto, parent) {
      return VERIFY == resolveFeature("utf8Validation", {
        proto,
        parent
      });
    }
    function resolveFeature(name, ref) {
      var _a, _b;
      let featureSet = (_a = ref.proto.options) === null || _a === void 0 ? void 0 : _a.features;
      if (featureSet) {
        let val = featureSet[name];
        if (val != 0)
          return val;
      }
      if ("kind" in ref) {
        if (ref.kind == "message")
          return resolveFeature(name, (_b = ref.parent) !== null && _b !== void 0 ? _b : ref.file);
        let editionDefaults = featureDefaults[ref.edition];
        if (!editionDefaults)
          throw new Error(`feature default for edition ${ref.edition} not found`);
        return editionDefaults[name];
      }
      return resolveFeature(name, ref.parent);
    }
    function assert2(condition, msg) {
      if (!condition)
        throw new Error(msg);
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/boot.js
var require_boot = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/boot.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.boot = boot;
    exports.bootFileDescriptorProto = bootFileDescriptorProto;
    var restore_json_names_js_1 = require_restore_json_names(), registry_js_1 = require_registry();
    function boot(boot2) {
      let root = bootFileDescriptorProto(boot2);
      return root.messageType.forEach(restore_json_names_js_1.restoreJsonNames), (0, registry_js_1.createFileRegistry)(root, () => {
      }).getFile(root.name);
    }
    function bootFileDescriptorProto(init) {
      return Object.assign(/* @__PURE__ */ Object.create({
        syntax: "",
        edition: 0
      }), Object.assign(Object.assign({ $typeName: "google.protobuf.FileDescriptorProto", dependency: [], publicDependency: [], weakDependency: [], optionDependency: [], service: [], extension: [] }, init), { messageType: init.messageType.map(bootDescriptorProto), enumType: init.enumType.map(bootEnumDescriptorProto) }));
    }
    function bootDescriptorProto(init) {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      return Object.assign(/* @__PURE__ */ Object.create({
        visibility: 0
      }), {
        $typeName: "google.protobuf.DescriptorProto",
        name: init.name,
        field: (_b = (_a = init.field) === null || _a === void 0 ? void 0 : _a.map(bootFieldDescriptorProto)) !== null && _b !== void 0 ? _b : [],
        extension: [],
        nestedType: (_d = (_c = init.nestedType) === null || _c === void 0 ? void 0 : _c.map(bootDescriptorProto)) !== null && _d !== void 0 ? _d : [],
        enumType: (_f = (_e = init.enumType) === null || _e === void 0 ? void 0 : _e.map(bootEnumDescriptorProto)) !== null && _f !== void 0 ? _f : [],
        extensionRange: (_h = (_g = init.extensionRange) === null || _g === void 0 ? void 0 : _g.map((e) => Object.assign({ $typeName: "google.protobuf.DescriptorProto.ExtensionRange" }, e))) !== null && _h !== void 0 ? _h : [],
        oneofDecl: [],
        reservedRange: [],
        reservedName: []
      });
    }
    function bootFieldDescriptorProto(init) {
      return Object.assign(/* @__PURE__ */ Object.create({
        label: 1,
        typeName: "",
        extendee: "",
        defaultValue: "",
        oneofIndex: 0,
        jsonName: "",
        proto3Optional: !1
      }), Object.assign(Object.assign({ $typeName: "google.protobuf.FieldDescriptorProto" }, init), { options: init.options ? bootFieldOptions(init.options) : void 0 }));
    }
    function bootFieldOptions(init) {
      var _a, _b, _c;
      return Object.assign(/* @__PURE__ */ Object.create({
        ctype: 0,
        packed: !1,
        jstype: 0,
        lazy: !1,
        unverifiedLazy: !1,
        deprecated: !1,
        weak: !1,
        debugRedact: !1,
        retention: 0
      }), Object.assign(Object.assign({ $typeName: "google.protobuf.FieldOptions" }, init), { targets: (_a = init.targets) !== null && _a !== void 0 ? _a : [], editionDefaults: (_c = (_b = init.editionDefaults) === null || _b === void 0 ? void 0 : _b.map((e) => Object.assign({ $typeName: "google.protobuf.FieldOptions.EditionDefault" }, e))) !== null && _c !== void 0 ? _c : [], uninterpretedOption: [] }));
    }
    function bootEnumDescriptorProto(init) {
      return Object.assign(/* @__PURE__ */ Object.create({
        visibility: 0
      }), {
        $typeName: "google.protobuf.EnumDescriptorProto",
        name: init.name,
        reservedName: [],
        reservedRange: [],
        value: init.value.map((e) => Object.assign({ $typeName: "google.protobuf.EnumValueDescriptorProto" }, e))
      });
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/message.js
var require_message2 = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/message.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.messageDesc = messageDesc3;
    function messageDesc3(file, path, ...paths) {
      return paths.reduce((acc, cur) => acc.nestedMessages[cur], file.messages[path]);
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/enum.js
var require_enum = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/enum.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.enumDesc = enumDesc2;
    exports.tsEnum = tsEnum;
    exports.objEnum = objEnum;
    function enumDesc2(file, path, ...paths) {
      if (paths.length == 0)
        return file.enums[path];
      let e = paths.pop();
      return paths.reduce((acc, cur) => acc.nestedMessages[cur], file.messages[path]).nestedEnums[e];
    }
    function tsEnum(desc) {
      let enumObject = {};
      for (let value of desc.values)
        enumObject[value.localName] = value.number, enumObject[value.number] = value.localName;
      return enumObject;
    }
    function objEnum(desc) {
      let enumObject = {};
      for (let value of desc.values)
        enumObject[value.localName] = value.number;
      return enumObject;
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/descriptor_pb.js
var require_descriptor_pb = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/descriptor_pb.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.FeatureSet_FieldPresence = exports.FeatureSet_VisibilityFeature_DefaultSymbolVisibilitySchema = exports.FeatureSet_VisibilityFeature_DefaultSymbolVisibility = exports.FeatureSet_VisibilityFeatureSchema = exports.FeatureSetSchema = exports.UninterpretedOption_NamePartSchema = exports.UninterpretedOptionSchema = exports.MethodOptions_IdempotencyLevelSchema = exports.MethodOptions_IdempotencyLevel = exports.MethodOptionsSchema = exports.ServiceOptionsSchema = exports.EnumValueOptionsSchema = exports.EnumOptionsSchema = exports.OneofOptionsSchema = exports.FieldOptions_OptionTargetTypeSchema = exports.FieldOptions_OptionTargetType = exports.FieldOptions_OptionRetentionSchema = exports.FieldOptions_OptionRetention = exports.FieldOptions_JSTypeSchema = exports.FieldOptions_JSType = exports.FieldOptions_CTypeSchema = exports.FieldOptions_CType = exports.FieldOptions_FeatureSupportSchema = exports.FieldOptions_EditionDefaultSchema = exports.FieldOptionsSchema = exports.MessageOptionsSchema = exports.FileOptions_OptimizeModeSchema = exports.FileOptions_OptimizeMode = exports.FileOptionsSchema = exports.MethodDescriptorProtoSchema = exports.ServiceDescriptorProtoSchema = exports.EnumValueDescriptorProtoSchema = exports.EnumDescriptorProto_EnumReservedRangeSchema = exports.EnumDescriptorProtoSchema = exports.OneofDescriptorProtoSchema = exports.FieldDescriptorProto_LabelSchema = exports.FieldDescriptorProto_Label = exports.FieldDescriptorProto_TypeSchema = exports.FieldDescriptorProto_Type = exports.FieldDescriptorProtoSchema = exports.ExtensionRangeOptions_VerificationStateSchema = exports.ExtensionRangeOptions_VerificationState = exports.ExtensionRangeOptions_DeclarationSchema = exports.ExtensionRangeOptionsSchema = exports.DescriptorProto_ReservedRangeSchema = exports.DescriptorProto_ExtensionRangeSchema = exports.DescriptorProtoSchema = exports.FileDescriptorProtoSchema = exports.FileDescriptorSetSchema = exports.file_google_protobuf_descriptor = void 0;
    exports.SymbolVisibilitySchema = exports.SymbolVisibility = exports.EditionSchema = exports.Edition = exports.GeneratedCodeInfo_Annotation_SemanticSchema = exports.GeneratedCodeInfo_Annotation_Semantic = exports.GeneratedCodeInfo_AnnotationSchema = exports.GeneratedCodeInfoSchema = exports.SourceCodeInfo_LocationSchema = exports.SourceCodeInfoSchema = exports.FeatureSetDefaults_FeatureSetEditionDefaultSchema = exports.FeatureSetDefaultsSchema = exports.FeatureSet_EnforceNamingStyleSchema = exports.FeatureSet_EnforceNamingStyle = exports.FeatureSet_JsonFormatSchema = exports.FeatureSet_JsonFormat = exports.FeatureSet_MessageEncodingSchema = exports.FeatureSet_MessageEncoding = exports.FeatureSet_Utf8ValidationSchema = exports.FeatureSet_Utf8Validation = exports.FeatureSet_RepeatedFieldEncodingSchema = exports.FeatureSet_RepeatedFieldEncoding = exports.FeatureSet_EnumTypeSchema = exports.FeatureSet_EnumType = exports.FeatureSet_FieldPresenceSchema = void 0;
    var boot_js_1 = require_boot(), message_js_1 = require_message2(), enum_js_1 = require_enum();
    exports.file_google_protobuf_descriptor = (0, boot_js_1.boot)({ name: "google/protobuf/descriptor.proto", package: "google.protobuf", messageType: [{ name: "FileDescriptorSet", field: [{ name: "file", number: 1, type: 11, label: 3, typeName: ".google.protobuf.FileDescriptorProto" }], extensionRange: [{ start: 536e6, end: 536000001 }] }, { name: "FileDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "package", number: 2, type: 9, label: 1 }, { name: "dependency", number: 3, type: 9, label: 3 }, { name: "public_dependency", number: 10, type: 5, label: 3 }, { name: "weak_dependency", number: 11, type: 5, label: 3 }, { name: "option_dependency", number: 15, type: 9, label: 3 }, { name: "message_type", number: 4, type: 11, label: 3, typeName: ".google.protobuf.DescriptorProto" }, { name: "enum_type", number: 5, type: 11, label: 3, typeName: ".google.protobuf.EnumDescriptorProto" }, { name: "service", number: 6, type: 11, label: 3, typeName: ".google.protobuf.ServiceDescriptorProto" }, { name: "extension", number: 7, type: 11, label: 3, typeName: ".google.protobuf.FieldDescriptorProto" }, { name: "options", number: 8, type: 11, label: 1, typeName: ".google.protobuf.FileOptions" }, { name: "source_code_info", number: 9, type: 11, label: 1, typeName: ".google.protobuf.SourceCodeInfo" }, { name: "syntax", number: 12, type: 9, label: 1 }, { name: "edition", number: 14, type: 14, label: 1, typeName: ".google.protobuf.Edition" }] }, { name: "DescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "field", number: 2, type: 11, label: 3, typeName: ".google.protobuf.FieldDescriptorProto" }, { name: "extension", number: 6, type: 11, label: 3, typeName: ".google.protobuf.FieldDescriptorProto" }, { name: "nested_type", number: 3, type: 11, label: 3, typeName: ".google.protobuf.DescriptorProto" }, { name: "enum_type", number: 4, type: 11, label: 3, typeName: ".google.protobuf.EnumDescriptorProto" }, { name: "extension_range", number: 5, type: 11, label: 3, typeName: ".google.protobuf.DescriptorProto.ExtensionRange" }, { name: "oneof_decl", number: 8, type: 11, label: 3, typeName: ".google.protobuf.OneofDescriptorProto" }, { name: "options", number: 7, type: 11, label: 1, typeName: ".google.protobuf.MessageOptions" }, { name: "reserved_range", number: 9, type: 11, label: 3, typeName: ".google.protobuf.DescriptorProto.ReservedRange" }, { name: "reserved_name", number: 10, type: 9, label: 3 }, { name: "visibility", number: 11, type: 14, label: 1, typeName: ".google.protobuf.SymbolVisibility" }], nestedType: [{ name: "ExtensionRange", field: [{ name: "start", number: 1, type: 5, label: 1 }, { name: "end", number: 2, type: 5, label: 1 }, { name: "options", number: 3, type: 11, label: 1, typeName: ".google.protobuf.ExtensionRangeOptions" }] }, { name: "ReservedRange", field: [{ name: "start", number: 1, type: 5, label: 1 }, { name: "end", number: 2, type: 5, label: 1 }] }] }, { name: "ExtensionRangeOptions", field: [{ name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }, { name: "declaration", number: 2, type: 11, label: 3, typeName: ".google.protobuf.ExtensionRangeOptions.Declaration", options: { retention: 2 } }, { name: "features", number: 50, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "verification", number: 3, type: 14, label: 1, typeName: ".google.protobuf.ExtensionRangeOptions.VerificationState", defaultValue: "UNVERIFIED", options: { retention: 2 } }], nestedType: [{ name: "Declaration", field: [{ name: "number", number: 1, type: 5, label: 1 }, { name: "full_name", number: 2, type: 9, label: 1 }, { name: "type", number: 3, type: 9, label: 1 }, { name: "reserved", number: 5, type: 8, label: 1 }, { name: "repeated", number: 6, type: 8, label: 1 }] }], enumType: [{ name: "VerificationState", value: [{ name: "DECLARATION", number: 0 }, { name: "UNVERIFIED", number: 1 }] }], extensionRange: [{ start: 1e3, end: 536870912 }] }, { name: "FieldDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "number", number: 3, type: 5, label: 1 }, { name: "label", number: 4, type: 14, label: 1, typeName: ".google.protobuf.FieldDescriptorProto.Label" }, { name: "type", number: 5, type: 14, label: 1, typeName: ".google.protobuf.FieldDescriptorProto.Type" }, { name: "type_name", number: 6, type: 9, label: 1 }, { name: "extendee", number: 2, type: 9, label: 1 }, { name: "default_value", number: 7, type: 9, label: 1 }, { name: "oneof_index", number: 9, type: 5, label: 1 }, { name: "json_name", number: 10, type: 9, label: 1 }, { name: "options", number: 8, type: 11, label: 1, typeName: ".google.protobuf.FieldOptions" }, { name: "proto3_optional", number: 17, type: 8, label: 1 }], enumType: [{ name: "Type", value: [{ name: "TYPE_DOUBLE", number: 1 }, { name: "TYPE_FLOAT", number: 2 }, { name: "TYPE_INT64", number: 3 }, { name: "TYPE_UINT64", number: 4 }, { name: "TYPE_INT32", number: 5 }, { name: "TYPE_FIXED64", number: 6 }, { name: "TYPE_FIXED32", number: 7 }, { name: "TYPE_BOOL", number: 8 }, { name: "TYPE_STRING", number: 9 }, { name: "TYPE_GROUP", number: 10 }, { name: "TYPE_MESSAGE", number: 11 }, { name: "TYPE_BYTES", number: 12 }, { name: "TYPE_UINT32", number: 13 }, { name: "TYPE_ENUM", number: 14 }, { name: "TYPE_SFIXED32", number: 15 }, { name: "TYPE_SFIXED64", number: 16 }, { name: "TYPE_SINT32", number: 17 }, { name: "TYPE_SINT64", number: 18 }] }, { name: "Label", value: [{ name: "LABEL_OPTIONAL", number: 1 }, { name: "LABEL_REPEATED", number: 3 }, { name: "LABEL_REQUIRED", number: 2 }] }] }, { name: "OneofDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "options", number: 2, type: 11, label: 1, typeName: ".google.protobuf.OneofOptions" }] }, { name: "EnumDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "value", number: 2, type: 11, label: 3, typeName: ".google.protobuf.EnumValueDescriptorProto" }, { name: "options", number: 3, type: 11, label: 1, typeName: ".google.protobuf.EnumOptions" }, { name: "reserved_range", number: 4, type: 11, label: 3, typeName: ".google.protobuf.EnumDescriptorProto.EnumReservedRange" }, { name: "reserved_name", number: 5, type: 9, label: 3 }, { name: "visibility", number: 6, type: 14, label: 1, typeName: ".google.protobuf.SymbolVisibility" }], nestedType: [{ name: "EnumReservedRange", field: [{ name: "start", number: 1, type: 5, label: 1 }, { name: "end", number: 2, type: 5, label: 1 }] }] }, { name: "EnumValueDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "number", number: 2, type: 5, label: 1 }, { name: "options", number: 3, type: 11, label: 1, typeName: ".google.protobuf.EnumValueOptions" }] }, { name: "ServiceDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "method", number: 2, type: 11, label: 3, typeName: ".google.protobuf.MethodDescriptorProto" }, { name: "options", number: 3, type: 11, label: 1, typeName: ".google.protobuf.ServiceOptions" }] }, { name: "MethodDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "input_type", number: 2, type: 9, label: 1 }, { name: "output_type", number: 3, type: 9, label: 1 }, { name: "options", number: 4, type: 11, label: 1, typeName: ".google.protobuf.MethodOptions" }, { name: "client_streaming", number: 5, type: 8, label: 1, defaultValue: "false" }, { name: "server_streaming", number: 6, type: 8, label: 1, defaultValue: "false" }] }, { name: "FileOptions", field: [{ name: "java_package", number: 1, type: 9, label: 1 }, { name: "java_outer_classname", number: 8, type: 9, label: 1 }, { name: "java_multiple_files", number: 10, type: 8, label: 1, defaultValue: "false", options: {} }, { name: "java_generate_equals_and_hash", number: 20, type: 8, label: 1, options: { deprecated: !0 } }, { name: "java_string_check_utf8", number: 27, type: 8, label: 1, defaultValue: "false" }, { name: "optimize_for", number: 9, type: 14, label: 1, typeName: ".google.protobuf.FileOptions.OptimizeMode", defaultValue: "SPEED" }, { name: "go_package", number: 11, type: 9, label: 1 }, { name: "cc_generic_services", number: 16, type: 8, label: 1, defaultValue: "false" }, { name: "java_generic_services", number: 17, type: 8, label: 1, defaultValue: "false" }, { name: "py_generic_services", number: 18, type: 8, label: 1, defaultValue: "false" }, { name: "deprecated", number: 23, type: 8, label: 1, defaultValue: "false" }, { name: "cc_enable_arenas", number: 31, type: 8, label: 1, defaultValue: "true" }, { name: "objc_class_prefix", number: 36, type: 9, label: 1 }, { name: "csharp_namespace", number: 37, type: 9, label: 1 }, { name: "swift_prefix", number: 39, type: 9, label: 1 }, { name: "php_class_prefix", number: 40, type: 9, label: 1 }, { name: "php_namespace", number: 41, type: 9, label: 1 }, { name: "php_metadata_namespace", number: 44, type: 9, label: 1 }, { name: "ruby_package", number: 45, type: 9, label: 1 }, { name: "features", number: 50, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], enumType: [{ name: "OptimizeMode", value: [{ name: "SPEED", number: 1 }, { name: "CODE_SIZE", number: 2 }, { name: "LITE_RUNTIME", number: 3 }] }], extensionRange: [{ start: 1e3, end: 536870912 }] }, { name: "MessageOptions", field: [{ name: "message_set_wire_format", number: 1, type: 8, label: 1, defaultValue: "false" }, { name: "no_standard_descriptor_accessor", number: 2, type: 8, label: 1, defaultValue: "false" }, { name: "deprecated", number: 3, type: 8, label: 1, defaultValue: "false" }, { name: "map_entry", number: 7, type: 8, label: 1 }, { name: "deprecated_legacy_json_field_conflicts", number: 11, type: 8, label: 1, options: { deprecated: !0 } }, { name: "features", number: 12, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], extensionRange: [{ start: 1e3, end: 536870912 }] }, { name: "FieldOptions", field: [{ name: "ctype", number: 1, type: 14, label: 1, typeName: ".google.protobuf.FieldOptions.CType", defaultValue: "STRING" }, { name: "packed", number: 2, type: 8, label: 1 }, { name: "jstype", number: 6, type: 14, label: 1, typeName: ".google.protobuf.FieldOptions.JSType", defaultValue: "JS_NORMAL" }, { name: "lazy", number: 5, type: 8, label: 1, defaultValue: "false" }, { name: "unverified_lazy", number: 15, type: 8, label: 1, defaultValue: "false" }, { name: "deprecated", number: 3, type: 8, label: 1, defaultValue: "false" }, { name: "weak", number: 10, type: 8, label: 1, defaultValue: "false", options: { deprecated: !0 } }, { name: "debug_redact", number: 16, type: 8, label: 1, defaultValue: "false" }, { name: "retention", number: 17, type: 14, label: 1, typeName: ".google.protobuf.FieldOptions.OptionRetention" }, { name: "targets", number: 19, type: 14, label: 3, typeName: ".google.protobuf.FieldOptions.OptionTargetType" }, { name: "edition_defaults", number: 20, type: 11, label: 3, typeName: ".google.protobuf.FieldOptions.EditionDefault" }, { name: "features", number: 21, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "feature_support", number: 22, type: 11, label: 1, typeName: ".google.protobuf.FieldOptions.FeatureSupport" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], nestedType: [{ name: "EditionDefault", field: [{ name: "edition", number: 3, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "value", number: 2, type: 9, label: 1 }] }, { name: "FeatureSupport", field: [{ name: "edition_introduced", number: 1, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "edition_deprecated", number: 2, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "deprecation_warning", number: 3, type: 9, label: 1 }, { name: "edition_removed", number: 4, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "removal_error", number: 5, type: 9, label: 1 }] }], enumType: [{ name: "CType", value: [{ name: "STRING", number: 0 }, { name: "CORD", number: 1 }, { name: "STRING_PIECE", number: 2 }] }, { name: "JSType", value: [{ name: "JS_NORMAL", number: 0 }, { name: "JS_STRING", number: 1 }, { name: "JS_NUMBER", number: 2 }] }, { name: "OptionRetention", value: [{ name: "RETENTION_UNKNOWN", number: 0 }, { name: "RETENTION_RUNTIME", number: 1 }, { name: "RETENTION_SOURCE", number: 2 }] }, { name: "OptionTargetType", value: [{ name: "TARGET_TYPE_UNKNOWN", number: 0 }, { name: "TARGET_TYPE_FILE", number: 1 }, { name: "TARGET_TYPE_EXTENSION_RANGE", number: 2 }, { name: "TARGET_TYPE_MESSAGE", number: 3 }, { name: "TARGET_TYPE_FIELD", number: 4 }, { name: "TARGET_TYPE_ONEOF", number: 5 }, { name: "TARGET_TYPE_ENUM", number: 6 }, { name: "TARGET_TYPE_ENUM_ENTRY", number: 7 }, { name: "TARGET_TYPE_SERVICE", number: 8 }, { name: "TARGET_TYPE_METHOD", number: 9 }] }], extensionRange: [{ start: 1e3, end: 536870912 }] }, { name: "OneofOptions", field: [{ name: "features", number: 1, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], extensionRange: [{ start: 1e3, end: 536870912 }] }, { name: "EnumOptions", field: [{ name: "allow_alias", number: 2, type: 8, label: 1 }, { name: "deprecated", number: 3, type: 8, label: 1, defaultValue: "false" }, { name: "deprecated_legacy_json_field_conflicts", number: 6, type: 8, label: 1, options: { deprecated: !0 } }, { name: "features", number: 7, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], extensionRange: [{ start: 1e3, end: 536870912 }] }, { name: "EnumValueOptions", field: [{ name: "deprecated", number: 1, type: 8, label: 1, defaultValue: "false" }, { name: "features", number: 2, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "debug_redact", number: 3, type: 8, label: 1, defaultValue: "false" }, { name: "feature_support", number: 4, type: 11, label: 1, typeName: ".google.protobuf.FieldOptions.FeatureSupport" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], extensionRange: [{ start: 1e3, end: 536870912 }] }, { name: "ServiceOptions", field: [{ name: "features", number: 34, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "deprecated", number: 33, type: 8, label: 1, defaultValue: "false" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], extensionRange: [{ start: 1e3, end: 536870912 }] }, { name: "MethodOptions", field: [{ name: "deprecated", number: 33, type: 8, label: 1, defaultValue: "false" }, { name: "idempotency_level", number: 34, type: 14, label: 1, typeName: ".google.protobuf.MethodOptions.IdempotencyLevel", defaultValue: "IDEMPOTENCY_UNKNOWN" }, { name: "features", number: 35, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], enumType: [{ name: "IdempotencyLevel", value: [{ name: "IDEMPOTENCY_UNKNOWN", number: 0 }, { name: "NO_SIDE_EFFECTS", number: 1 }, { name: "IDEMPOTENT", number: 2 }] }], extensionRange: [{ start: 1e3, end: 536870912 }] }, { name: "UninterpretedOption", field: [{ name: "name", number: 2, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption.NamePart" }, { name: "identifier_value", number: 3, type: 9, label: 1 }, { name: "positive_int_value", number: 4, type: 4, label: 1 }, { name: "negative_int_value", number: 5, type: 3, label: 1 }, { name: "double_value", number: 6, type: 1, label: 1 }, { name: "string_value", number: 7, type: 12, label: 1 }, { name: "aggregate_value", number: 8, type: 9, label: 1 }], nestedType: [{ name: "NamePart", field: [{ name: "name_part", number: 1, type: 9, label: 2 }, { name: "is_extension", number: 2, type: 8, label: 2 }] }] }, { name: "FeatureSet", field: [{ name: "field_presence", number: 1, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.FieldPresence", options: { retention: 1, targets: [4, 1], editionDefaults: [{ value: "EXPLICIT", edition: 900 }, { value: "IMPLICIT", edition: 999 }, { value: "EXPLICIT", edition: 1e3 }] } }, { name: "enum_type", number: 2, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.EnumType", options: { retention: 1, targets: [6, 1], editionDefaults: [{ value: "CLOSED", edition: 900 }, { value: "OPEN", edition: 999 }] } }, { name: "repeated_field_encoding", number: 3, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.RepeatedFieldEncoding", options: { retention: 1, targets: [4, 1], editionDefaults: [{ value: "EXPANDED", edition: 900 }, { value: "PACKED", edition: 999 }] } }, { name: "utf8_validation", number: 4, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.Utf8Validation", options: { retention: 1, targets: [4, 1], editionDefaults: [{ value: "NONE", edition: 900 }, { value: "VERIFY", edition: 999 }] } }, { name: "message_encoding", number: 5, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.MessageEncoding", options: { retention: 1, targets: [4, 1], editionDefaults: [{ value: "LENGTH_PREFIXED", edition: 900 }] } }, { name: "json_format", number: 6, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.JsonFormat", options: { retention: 1, targets: [3, 6, 1], editionDefaults: [{ value: "LEGACY_BEST_EFFORT", edition: 900 }, { value: "ALLOW", edition: 999 }] } }, { name: "enforce_naming_style", number: 7, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.EnforceNamingStyle", options: { retention: 2, targets: [1, 2, 3, 4, 5, 6, 7, 8, 9], editionDefaults: [{ value: "STYLE_LEGACY", edition: 900 }, { value: "STYLE2024", edition: 1001 }] } }, { name: "default_symbol_visibility", number: 8, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.VisibilityFeature.DefaultSymbolVisibility", options: { retention: 2, targets: [1], editionDefaults: [{ value: "EXPORT_ALL", edition: 900 }, { value: "EXPORT_TOP_LEVEL", edition: 1001 }] } }], nestedType: [{ name: "VisibilityFeature", enumType: [{ name: "DefaultSymbolVisibility", value: [{ name: "DEFAULT_SYMBOL_VISIBILITY_UNKNOWN", number: 0 }, { name: "EXPORT_ALL", number: 1 }, { name: "EXPORT_TOP_LEVEL", number: 2 }, { name: "LOCAL_ALL", number: 3 }, { name: "STRICT", number: 4 }] }] }], enumType: [{ name: "FieldPresence", value: [{ name: "FIELD_PRESENCE_UNKNOWN", number: 0 }, { name: "EXPLICIT", number: 1 }, { name: "IMPLICIT", number: 2 }, { name: "LEGACY_REQUIRED", number: 3 }] }, { name: "EnumType", value: [{ name: "ENUM_TYPE_UNKNOWN", number: 0 }, { name: "OPEN", number: 1 }, { name: "CLOSED", number: 2 }] }, { name: "RepeatedFieldEncoding", value: [{ name: "REPEATED_FIELD_ENCODING_UNKNOWN", number: 0 }, { name: "PACKED", number: 1 }, { name: "EXPANDED", number: 2 }] }, { name: "Utf8Validation", value: [{ name: "UTF8_VALIDATION_UNKNOWN", number: 0 }, { name: "VERIFY", number: 2 }, { name: "NONE", number: 3 }] }, { name: "MessageEncoding", value: [{ name: "MESSAGE_ENCODING_UNKNOWN", number: 0 }, { name: "LENGTH_PREFIXED", number: 1 }, { name: "DELIMITED", number: 2 }] }, { name: "JsonFormat", value: [{ name: "JSON_FORMAT_UNKNOWN", number: 0 }, { name: "ALLOW", number: 1 }, { name: "LEGACY_BEST_EFFORT", number: 2 }] }, { name: "EnforceNamingStyle", value: [{ name: "ENFORCE_NAMING_STYLE_UNKNOWN", number: 0 }, { name: "STYLE2024", number: 1 }, { name: "STYLE_LEGACY", number: 2 }] }], extensionRange: [{ start: 1e3, end: 9995 }, { start: 9995, end: 1e4 }, { start: 1e4, end: 10001 }] }, { name: "FeatureSetDefaults", field: [{ name: "defaults", number: 1, type: 11, label: 3, typeName: ".google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault" }, { name: "minimum_edition", number: 4, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "maximum_edition", number: 5, type: 14, label: 1, typeName: ".google.protobuf.Edition" }], nestedType: [{ name: "FeatureSetEditionDefault", field: [{ name: "edition", number: 3, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "overridable_features", number: 4, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "fixed_features", number: 5, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }] }] }, { name: "SourceCodeInfo", field: [{ name: "location", number: 1, type: 11, label: 3, typeName: ".google.protobuf.SourceCodeInfo.Location" }], nestedType: [{ name: "Location", field: [{ name: "path", number: 1, type: 5, label: 3, options: { packed: !0 } }, { name: "span", number: 2, type: 5, label: 3, options: { packed: !0 } }, { name: "leading_comments", number: 3, type: 9, label: 1 }, { name: "trailing_comments", number: 4, type: 9, label: 1 }, { name: "leading_detached_comments", number: 6, type: 9, label: 3 }] }], extensionRange: [{ start: 536e6, end: 536000001 }] }, { name: "GeneratedCodeInfo", field: [{ name: "annotation", number: 1, type: 11, label: 3, typeName: ".google.protobuf.GeneratedCodeInfo.Annotation" }], nestedType: [{ name: "Annotation", field: [{ name: "path", number: 1, type: 5, label: 3, options: { packed: !0 } }, { name: "source_file", number: 2, type: 9, label: 1 }, { name: "begin", number: 3, type: 5, label: 1 }, { name: "end", number: 4, type: 5, label: 1 }, { name: "semantic", number: 5, type: 14, label: 1, typeName: ".google.protobuf.GeneratedCodeInfo.Annotation.Semantic" }], enumType: [{ name: "Semantic", value: [{ name: "NONE", number: 0 }, { name: "SET", number: 1 }, { name: "ALIAS", number: 2 }] }] }] }], enumType: [{ name: "Edition", value: [{ name: "EDITION_UNKNOWN", number: 0 }, { name: "EDITION_LEGACY", number: 900 }, { name: "EDITION_PROTO2", number: 998 }, { name: "EDITION_PROTO3", number: 999 }, { name: "EDITION_2023", number: 1e3 }, { name: "EDITION_2024", number: 1001 }, { name: "EDITION_UNSTABLE", number: 9999 }, { name: "EDITION_1_TEST_ONLY", number: 1 }, { name: "EDITION_2_TEST_ONLY", number: 2 }, { name: "EDITION_99997_TEST_ONLY", number: 99997 }, { name: "EDITION_99998_TEST_ONLY", number: 99998 }, { name: "EDITION_99999_TEST_ONLY", number: 99999 }, { name: "EDITION_MAX", number: 2147483647 }] }, { name: "SymbolVisibility", value: [{ name: "VISIBILITY_UNSET", number: 0 }, { name: "VISIBILITY_LOCAL", number: 1 }, { name: "VISIBILITY_EXPORT", number: 2 }] }] });
    exports.FileDescriptorSetSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 0);
    exports.FileDescriptorProtoSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 1);
    exports.DescriptorProtoSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 2);
    exports.DescriptorProto_ExtensionRangeSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 2, 0);
    exports.DescriptorProto_ReservedRangeSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 2, 1);
    exports.ExtensionRangeOptionsSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 3);
    exports.ExtensionRangeOptions_DeclarationSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 3, 0);
    var ExtensionRangeOptions_VerificationState;
    (function(ExtensionRangeOptions_VerificationState2) {
      ExtensionRangeOptions_VerificationState2[ExtensionRangeOptions_VerificationState2.DECLARATION = 0] = "DECLARATION", ExtensionRangeOptions_VerificationState2[ExtensionRangeOptions_VerificationState2.UNVERIFIED = 1] = "UNVERIFIED";
    })(ExtensionRangeOptions_VerificationState || (exports.ExtensionRangeOptions_VerificationState = ExtensionRangeOptions_VerificationState = {}));
    exports.ExtensionRangeOptions_VerificationStateSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 3, 0);
    exports.FieldDescriptorProtoSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 4);
    var FieldDescriptorProto_Type;
    (function(FieldDescriptorProto_Type2) {
      FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.DOUBLE = 1] = "DOUBLE", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.FLOAT = 2] = "FLOAT", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.INT64 = 3] = "INT64", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.UINT64 = 4] = "UINT64", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.INT32 = 5] = "INT32", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.FIXED64 = 6] = "FIXED64", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.FIXED32 = 7] = "FIXED32", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.BOOL = 8] = "BOOL", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.STRING = 9] = "STRING", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.GROUP = 10] = "GROUP", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.MESSAGE = 11] = "MESSAGE", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.BYTES = 12] = "BYTES", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.UINT32 = 13] = "UINT32", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.ENUM = 14] = "ENUM", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.SFIXED32 = 15] = "SFIXED32", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.SFIXED64 = 16] = "SFIXED64", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.SINT32 = 17] = "SINT32", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.SINT64 = 18] = "SINT64";
    })(FieldDescriptorProto_Type || (exports.FieldDescriptorProto_Type = FieldDescriptorProto_Type = {}));
    exports.FieldDescriptorProto_TypeSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 4, 0);
    var FieldDescriptorProto_Label;
    (function(FieldDescriptorProto_Label2) {
      FieldDescriptorProto_Label2[FieldDescriptorProto_Label2.OPTIONAL = 1] = "OPTIONAL", FieldDescriptorProto_Label2[FieldDescriptorProto_Label2.REPEATED = 3] = "REPEATED", FieldDescriptorProto_Label2[FieldDescriptorProto_Label2.REQUIRED = 2] = "REQUIRED";
    })(FieldDescriptorProto_Label || (exports.FieldDescriptorProto_Label = FieldDescriptorProto_Label = {}));
    exports.FieldDescriptorProto_LabelSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 4, 1);
    exports.OneofDescriptorProtoSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 5);
    exports.EnumDescriptorProtoSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 6);
    exports.EnumDescriptorProto_EnumReservedRangeSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 6, 0);
    exports.EnumValueDescriptorProtoSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 7);
    exports.ServiceDescriptorProtoSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 8);
    exports.MethodDescriptorProtoSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 9);
    exports.FileOptionsSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 10);
    var FileOptions_OptimizeMode;
    (function(FileOptions_OptimizeMode2) {
      FileOptions_OptimizeMode2[FileOptions_OptimizeMode2.SPEED = 1] = "SPEED", FileOptions_OptimizeMode2[FileOptions_OptimizeMode2.CODE_SIZE = 2] = "CODE_SIZE", FileOptions_OptimizeMode2[FileOptions_OptimizeMode2.LITE_RUNTIME = 3] = "LITE_RUNTIME";
    })(FileOptions_OptimizeMode || (exports.FileOptions_OptimizeMode = FileOptions_OptimizeMode = {}));
    exports.FileOptions_OptimizeModeSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 10, 0);
    exports.MessageOptionsSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 11);
    exports.FieldOptionsSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 12);
    exports.FieldOptions_EditionDefaultSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 12, 0);
    exports.FieldOptions_FeatureSupportSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 12, 1);
    var FieldOptions_CType;
    (function(FieldOptions_CType2) {
      FieldOptions_CType2[FieldOptions_CType2.STRING = 0] = "STRING", FieldOptions_CType2[FieldOptions_CType2.CORD = 1] = "CORD", FieldOptions_CType2[FieldOptions_CType2.STRING_PIECE = 2] = "STRING_PIECE";
    })(FieldOptions_CType || (exports.FieldOptions_CType = FieldOptions_CType = {}));
    exports.FieldOptions_CTypeSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 12, 0);
    var FieldOptions_JSType;
    (function(FieldOptions_JSType2) {
      FieldOptions_JSType2[FieldOptions_JSType2.JS_NORMAL = 0] = "JS_NORMAL", FieldOptions_JSType2[FieldOptions_JSType2.JS_STRING = 1] = "JS_STRING", FieldOptions_JSType2[FieldOptions_JSType2.JS_NUMBER = 2] = "JS_NUMBER";
    })(FieldOptions_JSType || (exports.FieldOptions_JSType = FieldOptions_JSType = {}));
    exports.FieldOptions_JSTypeSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 12, 1);
    var FieldOptions_OptionRetention;
    (function(FieldOptions_OptionRetention2) {
      FieldOptions_OptionRetention2[FieldOptions_OptionRetention2.RETENTION_UNKNOWN = 0] = "RETENTION_UNKNOWN", FieldOptions_OptionRetention2[FieldOptions_OptionRetention2.RETENTION_RUNTIME = 1] = "RETENTION_RUNTIME", FieldOptions_OptionRetention2[FieldOptions_OptionRetention2.RETENTION_SOURCE = 2] = "RETENTION_SOURCE";
    })(FieldOptions_OptionRetention || (exports.FieldOptions_OptionRetention = FieldOptions_OptionRetention = {}));
    exports.FieldOptions_OptionRetentionSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 12, 2);
    var FieldOptions_OptionTargetType;
    (function(FieldOptions_OptionTargetType2) {
      FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_UNKNOWN = 0] = "TARGET_TYPE_UNKNOWN", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_FILE = 1] = "TARGET_TYPE_FILE", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_EXTENSION_RANGE = 2] = "TARGET_TYPE_EXTENSION_RANGE", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_MESSAGE = 3] = "TARGET_TYPE_MESSAGE", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_FIELD = 4] = "TARGET_TYPE_FIELD", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_ONEOF = 5] = "TARGET_TYPE_ONEOF", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_ENUM = 6] = "TARGET_TYPE_ENUM", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_ENUM_ENTRY = 7] = "TARGET_TYPE_ENUM_ENTRY", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_SERVICE = 8] = "TARGET_TYPE_SERVICE", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_METHOD = 9] = "TARGET_TYPE_METHOD";
    })(FieldOptions_OptionTargetType || (exports.FieldOptions_OptionTargetType = FieldOptions_OptionTargetType = {}));
    exports.FieldOptions_OptionTargetTypeSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 12, 3);
    exports.OneofOptionsSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 13);
    exports.EnumOptionsSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 14);
    exports.EnumValueOptionsSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 15);
    exports.ServiceOptionsSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 16);
    exports.MethodOptionsSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 17);
    var MethodOptions_IdempotencyLevel;
    (function(MethodOptions_IdempotencyLevel2) {
      MethodOptions_IdempotencyLevel2[MethodOptions_IdempotencyLevel2.IDEMPOTENCY_UNKNOWN = 0] = "IDEMPOTENCY_UNKNOWN", MethodOptions_IdempotencyLevel2[MethodOptions_IdempotencyLevel2.NO_SIDE_EFFECTS = 1] = "NO_SIDE_EFFECTS", MethodOptions_IdempotencyLevel2[MethodOptions_IdempotencyLevel2.IDEMPOTENT = 2] = "IDEMPOTENT";
    })(MethodOptions_IdempotencyLevel || (exports.MethodOptions_IdempotencyLevel = MethodOptions_IdempotencyLevel = {}));
    exports.MethodOptions_IdempotencyLevelSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 17, 0);
    exports.UninterpretedOptionSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 18);
    exports.UninterpretedOption_NamePartSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 18, 0);
    exports.FeatureSetSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 19);
    exports.FeatureSet_VisibilityFeatureSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 19, 0);
    var FeatureSet_VisibilityFeature_DefaultSymbolVisibility;
    (function(FeatureSet_VisibilityFeature_DefaultSymbolVisibility2) {
      FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2.DEFAULT_SYMBOL_VISIBILITY_UNKNOWN = 0] = "DEFAULT_SYMBOL_VISIBILITY_UNKNOWN", FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2.EXPORT_ALL = 1] = "EXPORT_ALL", FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2.EXPORT_TOP_LEVEL = 2] = "EXPORT_TOP_LEVEL", FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2.LOCAL_ALL = 3] = "LOCAL_ALL", FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2.STRICT = 4] = "STRICT";
    })(FeatureSet_VisibilityFeature_DefaultSymbolVisibility || (exports.FeatureSet_VisibilityFeature_DefaultSymbolVisibility = FeatureSet_VisibilityFeature_DefaultSymbolVisibility = {}));
    exports.FeatureSet_VisibilityFeature_DefaultSymbolVisibilitySchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 19, 0, 0);
    var FeatureSet_FieldPresence;
    (function(FeatureSet_FieldPresence2) {
      FeatureSet_FieldPresence2[FeatureSet_FieldPresence2.FIELD_PRESENCE_UNKNOWN = 0] = "FIELD_PRESENCE_UNKNOWN", FeatureSet_FieldPresence2[FeatureSet_FieldPresence2.EXPLICIT = 1] = "EXPLICIT", FeatureSet_FieldPresence2[FeatureSet_FieldPresence2.IMPLICIT = 2] = "IMPLICIT", FeatureSet_FieldPresence2[FeatureSet_FieldPresence2.LEGACY_REQUIRED = 3] = "LEGACY_REQUIRED";
    })(FeatureSet_FieldPresence || (exports.FeatureSet_FieldPresence = FeatureSet_FieldPresence = {}));
    exports.FeatureSet_FieldPresenceSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 19, 0);
    var FeatureSet_EnumType;
    (function(FeatureSet_EnumType2) {
      FeatureSet_EnumType2[FeatureSet_EnumType2.ENUM_TYPE_UNKNOWN = 0] = "ENUM_TYPE_UNKNOWN", FeatureSet_EnumType2[FeatureSet_EnumType2.OPEN = 1] = "OPEN", FeatureSet_EnumType2[FeatureSet_EnumType2.CLOSED = 2] = "CLOSED";
    })(FeatureSet_EnumType || (exports.FeatureSet_EnumType = FeatureSet_EnumType = {}));
    exports.FeatureSet_EnumTypeSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 19, 1);
    var FeatureSet_RepeatedFieldEncoding;
    (function(FeatureSet_RepeatedFieldEncoding2) {
      FeatureSet_RepeatedFieldEncoding2[FeatureSet_RepeatedFieldEncoding2.REPEATED_FIELD_ENCODING_UNKNOWN = 0] = "REPEATED_FIELD_ENCODING_UNKNOWN", FeatureSet_RepeatedFieldEncoding2[FeatureSet_RepeatedFieldEncoding2.PACKED = 1] = "PACKED", FeatureSet_RepeatedFieldEncoding2[FeatureSet_RepeatedFieldEncoding2.EXPANDED = 2] = "EXPANDED";
    })(FeatureSet_RepeatedFieldEncoding || (exports.FeatureSet_RepeatedFieldEncoding = FeatureSet_RepeatedFieldEncoding = {}));
    exports.FeatureSet_RepeatedFieldEncodingSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 19, 2);
    var FeatureSet_Utf8Validation;
    (function(FeatureSet_Utf8Validation2) {
      FeatureSet_Utf8Validation2[FeatureSet_Utf8Validation2.UTF8_VALIDATION_UNKNOWN = 0] = "UTF8_VALIDATION_UNKNOWN", FeatureSet_Utf8Validation2[FeatureSet_Utf8Validation2.VERIFY = 2] = "VERIFY", FeatureSet_Utf8Validation2[FeatureSet_Utf8Validation2.NONE = 3] = "NONE";
    })(FeatureSet_Utf8Validation || (exports.FeatureSet_Utf8Validation = FeatureSet_Utf8Validation = {}));
    exports.FeatureSet_Utf8ValidationSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 19, 3);
    var FeatureSet_MessageEncoding;
    (function(FeatureSet_MessageEncoding2) {
      FeatureSet_MessageEncoding2[FeatureSet_MessageEncoding2.MESSAGE_ENCODING_UNKNOWN = 0] = "MESSAGE_ENCODING_UNKNOWN", FeatureSet_MessageEncoding2[FeatureSet_MessageEncoding2.LENGTH_PREFIXED = 1] = "LENGTH_PREFIXED", FeatureSet_MessageEncoding2[FeatureSet_MessageEncoding2.DELIMITED = 2] = "DELIMITED";
    })(FeatureSet_MessageEncoding || (exports.FeatureSet_MessageEncoding = FeatureSet_MessageEncoding = {}));
    exports.FeatureSet_MessageEncodingSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 19, 4);
    var FeatureSet_JsonFormat;
    (function(FeatureSet_JsonFormat2) {
      FeatureSet_JsonFormat2[FeatureSet_JsonFormat2.JSON_FORMAT_UNKNOWN = 0] = "JSON_FORMAT_UNKNOWN", FeatureSet_JsonFormat2[FeatureSet_JsonFormat2.ALLOW = 1] = "ALLOW", FeatureSet_JsonFormat2[FeatureSet_JsonFormat2.LEGACY_BEST_EFFORT = 2] = "LEGACY_BEST_EFFORT";
    })(FeatureSet_JsonFormat || (exports.FeatureSet_JsonFormat = FeatureSet_JsonFormat = {}));
    exports.FeatureSet_JsonFormatSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 19, 5);
    var FeatureSet_EnforceNamingStyle;
    (function(FeatureSet_EnforceNamingStyle2) {
      FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2.ENFORCE_NAMING_STYLE_UNKNOWN = 0] = "ENFORCE_NAMING_STYLE_UNKNOWN", FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2.STYLE2024 = 1] = "STYLE2024", FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2.STYLE_LEGACY = 2] = "STYLE_LEGACY";
    })(FeatureSet_EnforceNamingStyle || (exports.FeatureSet_EnforceNamingStyle = FeatureSet_EnforceNamingStyle = {}));
    exports.FeatureSet_EnforceNamingStyleSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 19, 6);
    exports.FeatureSetDefaultsSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 20);
    exports.FeatureSetDefaults_FeatureSetEditionDefaultSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 20, 0);
    exports.SourceCodeInfoSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 21);
    exports.SourceCodeInfo_LocationSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 21, 0);
    exports.GeneratedCodeInfoSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 22);
    exports.GeneratedCodeInfo_AnnotationSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_descriptor, 22, 0);
    var GeneratedCodeInfo_Annotation_Semantic;
    (function(GeneratedCodeInfo_Annotation_Semantic2) {
      GeneratedCodeInfo_Annotation_Semantic2[GeneratedCodeInfo_Annotation_Semantic2.NONE = 0] = "NONE", GeneratedCodeInfo_Annotation_Semantic2[GeneratedCodeInfo_Annotation_Semantic2.SET = 1] = "SET", GeneratedCodeInfo_Annotation_Semantic2[GeneratedCodeInfo_Annotation_Semantic2.ALIAS = 2] = "ALIAS";
    })(GeneratedCodeInfo_Annotation_Semantic || (exports.GeneratedCodeInfo_Annotation_Semantic = GeneratedCodeInfo_Annotation_Semantic = {}));
    exports.GeneratedCodeInfo_Annotation_SemanticSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 22, 0, 0);
    var Edition;
    (function(Edition2) {
      Edition2[Edition2.EDITION_UNKNOWN = 0] = "EDITION_UNKNOWN", Edition2[Edition2.EDITION_LEGACY = 900] = "EDITION_LEGACY", Edition2[Edition2.EDITION_PROTO2 = 998] = "EDITION_PROTO2", Edition2[Edition2.EDITION_PROTO3 = 999] = "EDITION_PROTO3", Edition2[Edition2.EDITION_2023 = 1e3] = "EDITION_2023", Edition2[Edition2.EDITION_2024 = 1001] = "EDITION_2024", Edition2[Edition2.EDITION_UNSTABLE = 9999] = "EDITION_UNSTABLE", Edition2[Edition2.EDITION_1_TEST_ONLY = 1] = "EDITION_1_TEST_ONLY", Edition2[Edition2.EDITION_2_TEST_ONLY = 2] = "EDITION_2_TEST_ONLY", Edition2[Edition2.EDITION_99997_TEST_ONLY = 99997] = "EDITION_99997_TEST_ONLY", Edition2[Edition2.EDITION_99998_TEST_ONLY = 99998] = "EDITION_99998_TEST_ONLY", Edition2[Edition2.EDITION_99999_TEST_ONLY = 99999] = "EDITION_99999_TEST_ONLY", Edition2[Edition2.EDITION_MAX = 2147483647] = "EDITION_MAX";
    })(Edition || (exports.Edition = Edition = {}));
    exports.EditionSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 0);
    var SymbolVisibility;
    (function(SymbolVisibility2) {
      SymbolVisibility2[SymbolVisibility2.VISIBILITY_UNSET = 0] = "VISIBILITY_UNSET", SymbolVisibility2[SymbolVisibility2.VISIBILITY_LOCAL = 1] = "VISIBILITY_LOCAL", SymbolVisibility2[SymbolVisibility2.VISIBILITY_EXPORT = 2] = "VISIBILITY_EXPORT";
    })(SymbolVisibility || (exports.SymbolVisibility = SymbolVisibility = {}));
    exports.SymbolVisibilitySchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_descriptor, 1);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/from-binary.js
var require_from_binary = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/from-binary.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.makeReadContext = makeReadContext;
    exports.fromBinary = fromBinary4;
    exports.mergeFromBinary = mergeFromBinary;
    exports.readField = readField;
    var descriptors_js_1 = require_descriptors(), scalar_js_1 = require_scalar(), error_js_1 = require_error(), unsafe_js_1 = require_unsafe(), message_js_1 = require_message(), create_js_1 = require_create(), binary_encoding_js_1 = require_binary_encoding(), varint_js_1 = require_varint();
    function makeReadContext(options) {
      return Object.assign(Object.assign({ readUnknownFields: !0, recursionLimit: 100 }, options), { depth: 0 });
    }
    function fromBinary4(schema, bytes, options) {
      let message = (0, create_js_1.create)(schema);
      return compiledReader(schema).read(message, new binary_encoding_js_1.BinaryReader(bytes), makeReadContext(options), bytes.byteLength), message;
    }
    function mergeFromBinary(schema, target, bytes, options) {
      if (target.$typeName !== schema.typeName && schema.fields.length > 0)
        throw new error_js_1.FieldError(schema.fields[0], `cannot use ${schema.fields[0]} with message ${target.$typeName}`, "ForeignFieldError");
      return compiledReader(schema).read(target, new binary_encoding_js_1.BinaryReader(bytes), makeReadContext(options), bytes.byteLength), target;
    }
    var compiledReaders = /* @__PURE__ */ new WeakMap();
    function compiledReader(desc) {
      let compiled = compiledReaders.get(desc);
      return compiled === void 0 && (compiled = compileMessage(desc)), compiled;
    }
    function compileMessage(desc) {
      let descString = String(desc), fieldReaders = /* @__PURE__ */ new Map(), compiled = {
        read: compileMessageReader(descString, fieldReaders),
        readGroup: compileGroupReader(descString, fieldReaders)
      };
      compiledReaders.set(desc, compiled);
      for (let field of desc.fields)
        fieldReaders.set(field.number, compileFieldReader(field));
      return compiled;
    }
    function compileMessageReader(descString, fieldReaders) {
      return (message, reader, ctx, length) => {
        var _a;
        if (++ctx.depth > ctx.recursionLimit)
          throw new Error(`cannot decode ${descString} from binary: maximum recursion depth of ${ctx.recursionLimit} reached`);
        let end = reader.pos + length, unknownFields = (_a = message.$unknown) !== null && _a !== void 0 ? _a : [];
        for (; reader.pos < end; ) {
          let [fieldNo, wireType] = reader.tag(), fieldReader = fieldReaders.get(fieldNo);
          if (fieldReader === void 0) {
            let data = reader.skip(wireType, fieldNo, ctx.recursionLimit - ctx.depth);
            ctx.readUnknownFields && unknownFields.push({ no: fieldNo, wireType, data });
            continue;
          }
          fieldReader(message, reader, ctx, wireType);
        }
        unknownFields.length > 0 && (message.$unknown = unknownFields), ctx.depth--;
      };
    }
    function compileGroupReader(descString, fieldReaders) {
      return (message, reader, ctx, fieldNo) => {
        var _a;
        if (++ctx.depth > ctx.recursionLimit)
          throw new Error(`cannot decode ${descString} from binary: maximum recursion depth of ${ctx.recursionLimit} reached`);
        let recordFieldNo, wireType, unknownFields = (_a = message.$unknown) !== null && _a !== void 0 ? _a : [];
        for (; reader.pos < reader.len && ([recordFieldNo, wireType] = reader.tag(), wireType != binary_encoding_js_1.WireType.EndGroup); ) {
          let fieldReader = fieldReaders.get(recordFieldNo);
          if (fieldReader === void 0) {
            let data = reader.skip(wireType, recordFieldNo, ctx.recursionLimit - ctx.depth);
            ctx.readUnknownFields && unknownFields.push({ no: recordFieldNo, wireType, data });
            continue;
          }
          fieldReader(message, reader, ctx, wireType);
        }
        if (wireType != binary_encoding_js_1.WireType.EndGroup || recordFieldNo !== fieldNo)
          throw new Error("invalid end group tag");
        unknownFields.length > 0 && (message.$unknown = unknownFields), ctx.depth--;
      };
    }
    function readField(message, reader, field, wireType, ctx) {
      compileFieldReader(field)(message[unsafe_js_1.unsafeLocal], reader, ctx, wireType);
    }
    function compileFieldReader(field) {
      switch (field.fieldKind) {
        case "scalar":
          return compileScalarFieldReader(field);
        case "enum":
          return compileEnumFieldReader(field);
        case "message":
          return compileMessageFieldReader(field);
        case "list":
          return compileListFieldReader(field);
        case "map":
          return compileMapFieldReader(field);
      }
    }
    function compileScalarFieldReader(field) {
      let readScalar = compileScalarReader(field.scalar, field.utf8Validation, field.longAsString), localName = field.localName;
      if (field.oneof) {
        let oneofLocalName = field.oneof.localName;
        return (message, reader) => {
          message[oneofLocalName] = {
            case: localName,
            value: readScalar(reader)
          };
        };
      }
      return (message, reader) => {
        message[localName] = readScalar(reader);
      };
    }
    function compileEnumFieldReader(field) {
      var _a;
      let localName = field.localName, oneofLocalName = (_a = field.oneof) === null || _a === void 0 ? void 0 : _a.localName;
      if (field.enum.open)
        return oneofLocalName !== void 0 ? (message, reader) => {
          message[oneofLocalName] = { case: localName, value: reader.int32() };
        } : (message, reader) => {
          message[localName] = reader.int32();
        };
      let values = field.enum.values, fieldNo = field.number;
      return (message, reader, ctx, wireType) => {
        var _a2;
        let val = reader.int32();
        if (values.some((v) => v.number === val))
          oneofLocalName !== void 0 ? message[oneofLocalName] = { case: localName, value: val } : message[localName] = val;
        else if (ctx.readUnknownFields) {
          let bytes = [];
          (0, varint_js_1.varint32write)(val, bytes);
          let unknownFields = (_a2 = message.$unknown) !== null && _a2 !== void 0 ? _a2 : [];
          unknownFields.push({
            no: fieldNo,
            wireType,
            data: new Uint8Array(bytes)
          }), message.$unknown = unknownFields;
        }
      };
    }
    function compileMessageFieldReader(field) {
      let localName = field.localName, { toMessage, toLocal } = (0, message_js_1.localMessageMapper)(field), readChild = compileChildReader(field);
      if (field.oneof) {
        let oneofLocalName = field.oneof.localName;
        return (message, reader, ctx) => {
          let oneof = message[oneofLocalName], child = toMessage(oneof.case === localName ? oneof.value : void 0);
          readChild(child, reader, ctx), message[oneofLocalName] = { case: localName, value: toLocal(child) };
        };
      }
      return (message, reader, ctx) => {
        let child = toMessage(message[localName]);
        readChild(child, reader, ctx), message[localName] = toLocal(child);
      };
    }
    function compileChildReader(field) {
      let compiledChild = compiledReader(field.message);
      if (field.delimitedEncoding) {
        let fieldNo = field.number;
        return (child, reader, ctx) => compiledChild.readGroup(child, reader, ctx, fieldNo);
      }
      return (child, reader, ctx) => compiledChild.read(child, reader, ctx, reader.uint32());
    }
    function compileListFieldReader(field) {
      let localName = field.localName;
      if (field.listKind == "message") {
        let { toMessage, toLocal } = (0, message_js_1.localMessageMapper)(field), readChild = compileChildReader(field);
        return (message, reader, ctx) => {
          let child = toMessage(void 0);
          readChild(child, reader, ctx), message[localName].push(toLocal(child));
        };
      }
      let scalarType = field.listKind == "enum" ? descriptors_js_1.ScalarType.INT32 : field.scalar, longAsString = field.listKind == "scalar" ? field.longAsString : !1, readScalar = compileScalarReader(scalarType, field.utf8Validation, longAsString), packedPossible = scalarType != descriptors_js_1.ScalarType.STRING && scalarType != descriptors_js_1.ScalarType.BYTES;
      return (message, reader, ctx, wireType) => {
        let items = message[localName];
        if (wireType == binary_encoding_js_1.WireType.LengthDelimited && packedPossible) {
          let end = reader.uint32() + reader.pos;
          for (; reader.pos < end; )
            items.push(readScalar(reader));
        } else
          items.push(readScalar(reader));
      };
    }
    function compileMapFieldReader(field) {
      let localName = field.localName, readKey = compileScalarReader(field.mapKey, field.utf8Validation, !1), keyZero = (0, scalar_js_1.scalarZeroValue)(field.mapKey, !1), readValue, valueDefault;
      switch (field.mapKind) {
        case "scalar": {
          let scalar = field.scalar, readScalar = compileScalarReader(scalar, field.utf8Validation, !1);
          if (readValue = (reader) => readScalar(reader), scalar == descriptors_js_1.ScalarType.BYTES)
            valueDefault = () => new Uint8Array(0);
          else {
            let zero = (0, scalar_js_1.scalarZeroValue)(scalar, !1);
            valueDefault = () => zero;
          }
          break;
        }
        case "enum": {
          let zero = field.enum.values[0].number;
          readValue = (reader) => reader.int32(), valueDefault = () => zero;
          break;
        }
        case "message": {
          let { toMessage, toLocal } = (0, message_js_1.localMessageMapper)(field), readChild = compiledReader(field.message).read;
          readValue = (reader, ctx) => {
            let child = toMessage(void 0);
            return readChild(child, reader, ctx, reader.uint32()), toLocal(child);
          }, valueDefault = () => toLocal(toMessage(void 0));
          break;
        }
      }
      return (message, reader, ctx) => {
        let record = message[localName], key, val, len = reader.uint32(), end = reader.pos + len;
        for (; reader.pos < end; ) {
          let [fieldNo] = reader.tag();
          switch (fieldNo) {
            case 1:
              key = readKey(reader);
              break;
            case 2:
              val = readValue(reader, ctx);
              break;
          }
        }
        key === void 0 && (key = keyZero), val === void 0 && (val = valueDefault()), record[key] = val;
      };
    }
    function compileScalarReader(type, utf8Validation, longAsString) {
      switch (type) {
        case descriptors_js_1.ScalarType.STRING:
          return (reader) => reader.string(utf8Validation);
        case descriptors_js_1.ScalarType.BOOL:
          return (reader) => reader.bool();
        case descriptors_js_1.ScalarType.DOUBLE:
          return (reader) => reader.double();
        case descriptors_js_1.ScalarType.FLOAT:
          return (reader) => reader.float();
        case descriptors_js_1.ScalarType.INT32:
          return (reader) => reader.int32();
        case descriptors_js_1.ScalarType.INT64:
          return longAsString ? (reader) => String(reader.int64()) : (reader) => reader.int64();
        case descriptors_js_1.ScalarType.UINT64:
          return longAsString ? (reader) => String(reader.uint64()) : (reader) => reader.uint64();
        case descriptors_js_1.ScalarType.FIXED64:
          return longAsString ? (reader) => String(reader.fixed64()) : (reader) => reader.fixed64();
        case descriptors_js_1.ScalarType.BYTES:
          return (reader) => reader.bytes();
        case descriptors_js_1.ScalarType.FIXED32:
          return (reader) => reader.fixed32();
        case descriptors_js_1.ScalarType.SFIXED32:
          return (reader) => reader.sfixed32();
        case descriptors_js_1.ScalarType.SFIXED64:
          return longAsString ? (reader) => String(reader.sfixed64()) : (reader) => reader.sfixed64();
        case descriptors_js_1.ScalarType.SINT64:
          return longAsString ? (reader) => String(reader.sint64()) : (reader) => reader.sint64();
        case descriptors_js_1.ScalarType.UINT32:
          return (reader) => reader.uint32();
        case descriptors_js_1.ScalarType.SINT32:
          return (reader) => reader.sint32();
      }
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/file.js
var require_file = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/file.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.fileDesc = fileDesc3;
    var base64_encoding_js_1 = require_base64_encoding(), descriptor_pb_js_1 = require_descriptor_pb(), registry_js_1 = require_registry(), restore_json_names_js_1 = require_restore_json_names(), from_binary_js_1 = require_from_binary();
    function fileDesc3(b64, imports) {
      var _a;
      let root = (0, from_binary_js_1.fromBinary)(descriptor_pb_js_1.FileDescriptorProtoSchema, (0, base64_encoding_js_1.base64Decode)(b64));
      return root.messageType.forEach(restore_json_names_js_1.restoreJsonNames), root.dependency = (_a = imports?.map((f) => f.proto.name)) !== null && _a !== void 0 ? _a : [], (0, registry_js_1.createFileRegistry)(root, (protoFileName) => imports?.find((f) => f.proto.name === protoFileName)).getFile(root.name);
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/timestamp_pb.js
var require_timestamp_pb = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/timestamp_pb.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.TimestampSchema = exports.file_google_protobuf_timestamp = void 0;
    var file_js_1 = require_file(), message_js_1 = require_message2();
    exports.file_google_protobuf_timestamp = (0, file_js_1.fileDesc)("Ch9nb29nbGUvcHJvdG9idWYvdGltZXN0YW1wLnByb3RvEg9nb29nbGUucHJvdG9idWYiKwoJVGltZXN0YW1wEg8KB3NlY29uZHMYASABKAMSDQoFbmFub3MYAiABKAVChQEKE2NvbS5nb29nbGUucHJvdG9idWZCDlRpbWVzdGFtcFByb3RvUAFaMmdvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL3RpbWVzdGFtcHBi+AEBogIDR1BCqgIeR29vZ2xlLlByb3RvYnVmLldlbGxLbm93blR5cGVzYgZwcm90bzM");
    exports.TimestampSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_timestamp, 0);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/timestamp.js
var require_timestamp = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/timestamp.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.timestampNow = timestampNow;
    exports.timestampFromDate = timestampFromDate;
    exports.timestampDate = timestampDate;
    exports.timestampFromMs = timestampFromMs;
    exports.timestampMs = timestampMs;
    var timestamp_pb_js_1 = require_timestamp_pb(), create_js_1 = require_create(), proto_int64_js_1 = require_proto_int64();
    function timestampNow() {
      return timestampFromDate(/* @__PURE__ */ new Date());
    }
    function timestampFromDate(date) {
      return timestampFromMs(date.getTime());
    }
    function timestampDate(timestamp) {
      return new Date(timestampMs(timestamp));
    }
    function timestampFromMs(timestampMs2) {
      let seconds = Math.floor(timestampMs2 / 1e3);
      return (0, create_js_1.create)(timestamp_pb_js_1.TimestampSchema, {
        seconds: proto_int64_js_1.protoInt64.parse(seconds),
        nanos: (timestampMs2 - seconds * 1e3) * 1e6
      });
    }
    function timestampMs(timestamp) {
      return Number(timestamp.seconds) * 1e3 + Math.round(timestamp.nanos / 1e6);
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/duration_pb.js
var require_duration_pb = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/duration_pb.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.DurationSchema = exports.file_google_protobuf_duration = void 0;
    var file_js_1 = require_file(), message_js_1 = require_message2();
    exports.file_google_protobuf_duration = (0, file_js_1.fileDesc)("Ch5nb29nbGUvcHJvdG9idWYvZHVyYXRpb24ucHJvdG8SD2dvb2dsZS5wcm90b2J1ZiIqCghEdXJhdGlvbhIPCgdzZWNvbmRzGAEgASgDEg0KBW5hbm9zGAIgASgFQoMBChNjb20uZ29vZ2xlLnByb3RvYnVmQg1EdXJhdGlvblByb3RvUAFaMWdvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL2R1cmF0aW9ucGL4AQGiAgNHUEKqAh5Hb29nbGUuUHJvdG9idWYuV2VsbEtub3duVHlwZXNiBnByb3RvMw");
    exports.DurationSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_duration, 0);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/duration.js
var require_duration = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/duration.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.durationFromMs = durationFromMs;
    exports.durationMs = durationMs;
    var duration_pb_js_1 = require_duration_pb(), create_js_1 = require_create(), proto_int64_js_1 = require_proto_int64();
    function durationFromMs(durationMs2) {
      let sign = durationMs2 < 0 ? -1 : 1, absDurationMs = Math.abs(durationMs2), absSeconds = Math.floor(absDurationMs / 1e3), absNanos = (absDurationMs - absSeconds * 1e3) * 1e6;
      return (0, create_js_1.create)(duration_pb_js_1.DurationSchema, {
        seconds: proto_int64_js_1.protoInt64.parse(absSeconds * sign),
        nanos: absNanos === 0 ? 0 : absNanos * sign
        // deliberately avoid signed 0 - it does not serialize
      });
    }
    function durationMs(duration) {
      return Number(duration.seconds) * 1e3 + Math.round(duration.nanos / 1e6);
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/any_pb.js
var require_any_pb = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/any_pb.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.AnySchema = exports.file_google_protobuf_any = void 0;
    var file_js_1 = require_file(), message_js_1 = require_message2();
    exports.file_google_protobuf_any = (0, file_js_1.fileDesc)("Chlnb29nbGUvcHJvdG9idWYvYW55LnByb3RvEg9nb29nbGUucHJvdG9idWYiJgoDQW55EhAKCHR5cGVfdXJsGAEgASgJEg0KBXZhbHVlGAIgASgMQnYKE2NvbS5nb29nbGUucHJvdG9idWZCCEFueVByb3RvUAFaLGdvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL2FueXBiogIDR1BCqgIeR29vZ2xlLlByb3RvYnVmLldlbGxLbm93blR5cGVzYgZwcm90bzM");
    exports.AnySchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_any, 0);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/to-binary.js
var require_to_binary = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/to-binary.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.toBinary = toBinary3;
    exports.writeField = writeField;
    var binary_encoding_js_1 = require_binary_encoding(), descriptors_js_1 = require_descriptors(), error_js_1 = require_error(), unsafe_js_1 = require_unsafe(), message_js_1 = require_message(), proto_int64_js_1 = require_proto_int64(), IMPLICIT = 2, LEGACY_REQUIRED = 3, writeDefaults = {
      writeUnknownFields: !0
    };
    function makeWriteOptions(options) {
      return options ? Object.assign(Object.assign({}, writeDefaults), options) : writeDefaults;
    }
    function toBinary3(schema, message, options) {
      let writer = new binary_encoding_js_1.BinaryWriter();
      return compiledWriter(schema)(writer, makeWriteOptions(options), message), writer.finish();
    }
    var compiledWriters = /* @__PURE__ */ new WeakMap();
    function compiledWriter(desc) {
      let compiled = compiledWriters.get(desc);
      return compiled === void 0 && (compiled = compileMessage(desc)), compiled;
    }
    function compileMessage(desc) {
      let typeName = desc.typeName, sortedFields = desc.fields.concat().sort((a, b) => a.number - b.number), foreignField = sortedFields[0], fieldWriters = [], compiled = (writer, opts, message) => {
        if (message.$typeName !== typeName && foreignField !== void 0)
          throw new error_js_1.FieldError(foreignField, `cannot use ${foreignField} with message ${message.$typeName}`, "ForeignFieldError");
        for (let i = 0; i < fieldWriters.length; i++)
          fieldWriters[i](writer, opts, message);
        let unknown = message.$unknown;
        if (unknown !== void 0 && opts.writeUnknownFields)
          for (let i = 0; i < unknown.length; i++) {
            let { no, wireType, data } = unknown[i];
            writer.tag(no, wireType).raw(data);
          }
      };
      compiledWriters.set(desc, compiled);
      for (let field of sortedFields)
        fieldWriters.push(compileField(field));
      return compiled;
    }
    function compileField(field) {
      switch (field.fieldKind) {
        case "message":
        case "scalar":
        case "enum":
          return compileSingularField(field);
        case "list":
          return compileListField(field);
        case "map":
          return compileMapField(field);
      }
    }
    function compileSingularField(field) {
      let writeValue = compileSingularValue(field), localName = field.localName;
      if (field.oneof) {
        let oneofLocalName = field.oneof.localName;
        return (writer, opts, message) => {
          let oneof = message[oneofLocalName];
          oneof.case === localName && writeValue(writer, opts, oneof.value);
        };
      }
      if (field.presence != IMPLICIT) {
        let requiredError = field.presence == LEGACY_REQUIRED ? `cannot encode ${field} to binary: required field not set` : void 0;
        return (writer, opts, message) => {
          let value = message[localName];
          if (value !== void 0 && Object.prototype.hasOwnProperty.call(message, localName))
            writeValue(writer, opts, value);
          else if (requiredError !== void 0)
            throw new Error(requiredError);
        };
      }
      if (field.fieldKind == "enum") {
        let zero = field.enum.values[0].number;
        return (writer, opts, message) => {
          let value = message[localName];
          value !== zero && writeValue(writer, opts, value);
        };
      }
      switch (field.scalar) {
        case descriptors_js_1.ScalarType.BOOL:
          return (writer, opts, message) => {
            let value = message[localName];
            value !== !1 && writeValue(writer, opts, value);
          };
        case descriptors_js_1.ScalarType.STRING:
          return (writer, opts, message) => {
            let value = message[localName];
            value !== "" && writeValue(writer, opts, value);
          };
        case descriptors_js_1.ScalarType.BYTES:
          return (writer, opts, message) => {
            let value = message[localName];
            (!(value instanceof Uint8Array) || value.byteLength > 0) && writeValue(writer, opts, value);
          };
        case descriptors_js_1.ScalarType.DOUBLE:
        case descriptors_js_1.ScalarType.FLOAT:
          return (writer, opts, message) => {
            let value = message[localName];
            Object.is(value, 0) || writeValue(writer, opts, value);
          };
        default:
          return (writer, opts, message) => {
            let value = message[localName];
            value != 0 && writeValue(writer, opts, value);
          };
      }
    }
    function compileSingularValue(field) {
      switch (field.fieldKind) {
        case "message": {
          let { toMessage } = (0, message_js_1.localMessageMapper)(field), writeChild = compileChildWriter(field);
          return (writer, opts, value) => {
            writeChild(writer, opts, toMessage(value));
          };
        }
        case "scalar":
        case "enum": {
          let scalarType = field.fieldKind == "enum" ? descriptors_js_1.ScalarType.INT32 : field.scalar, fieldNo = field.number, wireType = writeTypeOfScalar(scalarType), writeScalar = compileScalarValue(scalarType, field.parent.typeName, field.name);
          return (writer, opts, value) => {
            writer.tag(fieldNo, wireType), writeScalar(writer, value);
          };
        }
      }
    }
    function compileListField(field) {
      let localName = field.localName, fieldNo = field.number;
      switch (field.listKind) {
        case "message": {
          let { toMessage } = (0, message_js_1.localMessageMapper)(field), writeChild = compileChildWriter(field);
          return (writer, opts, message) => {
            let items = message[localName];
            for (let i = 0; i < items.length; i++)
              writeChild(writer, opts, toMessage(items[i]));
          };
        }
        case "scalar":
        case "enum": {
          let scalarType = field.listKind == "enum" ? descriptors_js_1.ScalarType.INT32 : field.scalar, writeScalar = compileScalarValue(scalarType, field.parent.typeName, field.name);
          if (field.packed)
            return (writer, opts, message) => {
              let items = message[localName];
              if (items.length != 0) {
                writer.tag(fieldNo, binary_encoding_js_1.WireType.LengthDelimited).fork();
                for (let i = 0; i < items.length; i++)
                  writeScalar(writer, items[i]);
                writer.join();
              }
            };
          let wireType = writeTypeOfScalar(scalarType);
          return (writer, opts, message) => {
            let items = message[localName];
            for (let i = 0; i < items.length; i++)
              writer.tag(fieldNo, wireType), writeScalar(writer, items[i]);
          };
        }
      }
    }
    function compileMapField(field) {
      let localName = field.localName, fieldNo = field.number, writeKey = compileMapKey(field);
      if (field.mapKind == "message") {
        let { toMessage } = (0, message_js_1.localMessageMapper)(field), writeMessage = compiledWriter(field.message);
        return (writer, opts, message) => {
          let record = message[localName], keys = Object.keys(record);
          for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            writer.tag(fieldNo, binary_encoding_js_1.WireType.LengthDelimited).fork(), writeKey(writer, key), writer.tag(2, binary_encoding_js_1.WireType.LengthDelimited).fork(), writeMessage(writer, opts, toMessage(record[key])), writer.join(), writer.join();
          }
        };
      }
      let scalarType = field.mapKind == "enum" ? descriptors_js_1.ScalarType.INT32 : field.scalar, valueWireType = writeTypeOfScalar(scalarType), writeScalar = compileScalarValue(scalarType, field.parent.typeName, field.name);
      return (writer, opts, message) => {
        let record = message[localName], keys = Object.keys(record);
        for (let i = 0; i < keys.length; i++) {
          let key = keys[i];
          writer.tag(fieldNo, binary_encoding_js_1.WireType.LengthDelimited).fork(), writeKey(writer, key), writer.tag(2, valueWireType), writeScalar(writer, record[key]), writer.join();
        }
      };
    }
    function compileMapKey(field) {
      let wireType = writeTypeOfScalar(field.mapKey), writeScalar = compileScalarValue(field.mapKey, field.parent.typeName, field.name), convertKey = compileMapKeyConverter(field.mapKey);
      return (writer, key) => {
        writer.tag(1, wireType), writeScalar(writer, convertKey(key));
      };
    }
    function compileMapKeyConverter(type) {
      switch (type) {
        case descriptors_js_1.ScalarType.STRING:
          return (key) => key;
        case descriptors_js_1.ScalarType.BOOL:
          return (key) => key === "true" ? !0 : key === "false" ? !1 : key;
        case descriptors_js_1.ScalarType.UINT64:
        case descriptors_js_1.ScalarType.FIXED64:
          return (key) => {
            try {
              return proto_int64_js_1.protoInt64.uParse(key);
            } catch {
              return key;
            }
          };
        case descriptors_js_1.ScalarType.INT64:
        case descriptors_js_1.ScalarType.SFIXED64:
        case descriptors_js_1.ScalarType.SINT64:
          return (key) => {
            try {
              return proto_int64_js_1.protoInt64.parse(key);
            } catch {
              return key;
            }
          };
        default:
          return (key) => {
            let n = Number.parseInt(key);
            return Number.isFinite(n) ? n : key;
          };
      }
    }
    function compileScalarValue(type, messageName, fieldName) {
      let writeScalar = compileScalarWrite(type);
      return (writer, value) => {
        try {
          writeScalar(writer, value);
        } catch (e) {
          throw e instanceof Error ? new Error(`cannot encode field ${messageName}.${fieldName} to binary: ${e.message}`) : e;
        }
      };
    }
    function compileScalarWrite(type) {
      switch (type) {
        case descriptors_js_1.ScalarType.STRING:
          return (writer, value) => writer.string(value);
        case descriptors_js_1.ScalarType.BOOL:
          return (writer, value) => writer.bool(value);
        case descriptors_js_1.ScalarType.DOUBLE:
          return (writer, value) => writer.double(value);
        case descriptors_js_1.ScalarType.FLOAT:
          return (writer, value) => writer.float(value);
        case descriptors_js_1.ScalarType.INT32:
          return (writer, value) => writer.int32(value);
        case descriptors_js_1.ScalarType.INT64:
          return (writer, value) => writer.int64(value);
        case descriptors_js_1.ScalarType.UINT64:
          return (writer, value) => writer.uint64(value);
        case descriptors_js_1.ScalarType.FIXED64:
          return (writer, value) => writer.fixed64(value);
        case descriptors_js_1.ScalarType.BYTES:
          return (writer, value) => writer.bytes(value);
        case descriptors_js_1.ScalarType.FIXED32:
          return (writer, value) => writer.fixed32(value);
        case descriptors_js_1.ScalarType.SFIXED32:
          return (writer, value) => writer.sfixed32(value);
        case descriptors_js_1.ScalarType.SFIXED64:
          return (writer, value) => writer.sfixed64(value);
        case descriptors_js_1.ScalarType.SINT64:
          return (writer, value) => writer.sint64(value);
        case descriptors_js_1.ScalarType.UINT32:
          return (writer, value) => writer.uint32(value);
        case descriptors_js_1.ScalarType.SINT32:
          return (writer, value) => writer.sint32(value);
      }
    }
    function writeField(writer, opts, msg, field) {
      compileField(field)(writer, opts, msg[unsafe_js_1.unsafeLocal]);
    }
    function compileChildWriter(field) {
      let fieldNo = field.number, writeMessage = compiledWriter(field.message);
      return field.delimitedEncoding ? (writer, opts, child) => {
        writer.tag(fieldNo, binary_encoding_js_1.WireType.StartGroup), writeMessage(writer, opts, child), writer.tag(fieldNo, binary_encoding_js_1.WireType.EndGroup);
      } : (writer, opts, child) => {
        writer.tag(fieldNo, binary_encoding_js_1.WireType.LengthDelimited).fork(), writeMessage(writer, opts, child), writer.join();
      };
    }
    function writeTypeOfScalar(type) {
      switch (type) {
        case descriptors_js_1.ScalarType.BYTES:
        case descriptors_js_1.ScalarType.STRING:
          return binary_encoding_js_1.WireType.LengthDelimited;
        case descriptors_js_1.ScalarType.DOUBLE:
        case descriptors_js_1.ScalarType.FIXED64:
        case descriptors_js_1.ScalarType.SFIXED64:
          return binary_encoding_js_1.WireType.Bit64;
        case descriptors_js_1.ScalarType.FIXED32:
        case descriptors_js_1.ScalarType.SFIXED32:
        case descriptors_js_1.ScalarType.FLOAT:
          return binary_encoding_js_1.WireType.Bit32;
        default:
          return binary_encoding_js_1.WireType.Varint;
      }
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/any.js
var require_any = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/any.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.anyPack = anyPack;
    exports.anyIs = anyIs;
    exports.anyUnpack = anyUnpack;
    exports.anyUnpackTo = anyUnpackTo;
    var any_pb_js_1 = require_any_pb(), create_js_1 = require_create(), to_binary_js_1 = require_to_binary(), from_binary_js_1 = require_from_binary();
    function anyPack(schema, message, into) {
      let ret = !1;
      return into || (into = (0, create_js_1.create)(any_pb_js_1.AnySchema), ret = !0), into.value = (0, to_binary_js_1.toBinary)(schema, message), into.typeUrl = typeNameToUrl(message.$typeName), ret ? into : void 0;
    }
    function anyIs(any, descOrTypeName) {
      if (any.typeUrl === "")
        return !1;
      let want = typeof descOrTypeName == "string" ? descOrTypeName : descOrTypeName.typeName, got = typeUrlToName(any.typeUrl);
      return want === got;
    }
    function anyUnpack(any, registryOrMessageDesc) {
      if (any.typeUrl === "")
        return;
      let desc = registryOrMessageDesc.kind == "message" ? registryOrMessageDesc : registryOrMessageDesc.getMessage(typeUrlToName(any.typeUrl));
      if (!(!desc || !anyIs(any, desc)))
        return (0, from_binary_js_1.fromBinary)(desc, any.value);
    }
    function anyUnpackTo(any, schema, message) {
      if (anyIs(any, schema))
        return (0, from_binary_js_1.mergeFromBinary)(schema, message, any.value);
    }
    function typeNameToUrl(name) {
      return `type.googleapis.com/${name}`;
    }
    function typeUrlToName(url) {
      let slash = url.lastIndexOf("/"), name = slash >= 0 ? url.substring(slash + 1) : url;
      if (!name.length)
        throw new Error(`invalid type url: ${url}`);
      return name;
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/source_context_pb.js
var require_source_context_pb = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/source_context_pb.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.SourceContextSchema = exports.file_google_protobuf_source_context = void 0;
    var file_js_1 = require_file(), message_js_1 = require_message2();
    exports.file_google_protobuf_source_context = (0, file_js_1.fileDesc)("CiRnb29nbGUvcHJvdG9idWYvc291cmNlX2NvbnRleHQucHJvdG8SD2dvb2dsZS5wcm90b2J1ZiIiCg1Tb3VyY2VDb250ZXh0EhEKCWZpbGVfbmFtZRgBIAEoCUKKAQoTY29tLmdvb2dsZS5wcm90b2J1ZkISU291cmNlQ29udGV4dFByb3RvUAFaNmdvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL3NvdXJjZWNvbnRleHRwYqICA0dQQqoCHkdvb2dsZS5Qcm90b2J1Zi5XZWxsS25vd25UeXBlc2IGcHJvdG8z");
    exports.SourceContextSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_source_context, 0);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/type_pb.js
var require_type_pb = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/type_pb.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.SyntaxSchema = exports.Syntax = exports.OptionSchema = exports.EnumValueSchema = exports.EnumSchema = exports.Field_CardinalitySchema = exports.Field_Cardinality = exports.Field_KindSchema = exports.Field_Kind = exports.FieldSchema = exports.TypeSchema = exports.file_google_protobuf_type = void 0;
    var file_js_1 = require_file(), any_pb_js_1 = require_any_pb(), source_context_pb_js_1 = require_source_context_pb(), message_js_1 = require_message2(), enum_js_1 = require_enum();
    exports.file_google_protobuf_type = (0, file_js_1.fileDesc)("Chpnb29nbGUvcHJvdG9idWYvdHlwZS5wcm90bxIPZ29vZ2xlLnByb3RvYnVmIugBCgRUeXBlEgwKBG5hbWUYASABKAkSJgoGZmllbGRzGAIgAygLMhYuZ29vZ2xlLnByb3RvYnVmLkZpZWxkEg4KBm9uZW9mcxgDIAMoCRIoCgdvcHRpb25zGAQgAygLMhcuZ29vZ2xlLnByb3RvYnVmLk9wdGlvbhI2Cg5zb3VyY2VfY29udGV4dBgFIAEoCzIeLmdvb2dsZS5wcm90b2J1Zi5Tb3VyY2VDb250ZXh0EicKBnN5bnRheBgGIAEoDjIXLmdvb2dsZS5wcm90b2J1Zi5TeW50YXgSDwoHZWRpdGlvbhgHIAEoCSLVBQoFRmllbGQSKQoEa2luZBgBIAEoDjIbLmdvb2dsZS5wcm90b2J1Zi5GaWVsZC5LaW5kEjcKC2NhcmRpbmFsaXR5GAIgASgOMiIuZ29vZ2xlLnByb3RvYnVmLkZpZWxkLkNhcmRpbmFsaXR5Eg4KBm51bWJlchgDIAEoBRIMCgRuYW1lGAQgASgJEhAKCHR5cGVfdXJsGAYgASgJEhMKC29uZW9mX2luZGV4GAcgASgFEg4KBnBhY2tlZBgIIAEoCBIoCgdvcHRpb25zGAkgAygLMhcuZ29vZ2xlLnByb3RvYnVmLk9wdGlvbhIRCglqc29uX25hbWUYCiABKAkSFQoNZGVmYXVsdF92YWx1ZRgLIAEoCSLIAgoES2luZBIQCgxUWVBFX1VOS05PV04QABIPCgtUWVBFX0RPVUJMRRABEg4KClRZUEVfRkxPQVQQAhIOCgpUWVBFX0lOVDY0EAMSDwoLVFlQRV9VSU5UNjQQBBIOCgpUWVBFX0lOVDMyEAUSEAoMVFlQRV9GSVhFRDY0EAYSEAoMVFlQRV9GSVhFRDMyEAcSDQoJVFlQRV9CT09MEAgSDwoLVFlQRV9TVFJJTkcQCRIOCgpUWVBFX0dST1VQEAoSEAoMVFlQRV9NRVNTQUdFEAsSDgoKVFlQRV9CWVRFUxAMEg8KC1RZUEVfVUlOVDMyEA0SDQoJVFlQRV9FTlVNEA4SEQoNVFlQRV9TRklYRUQzMhAPEhEKDVRZUEVfU0ZJWEVENjQQEBIPCgtUWVBFX1NJTlQzMhAREg8KC1RZUEVfU0lOVDY0EBIidAoLQ2FyZGluYWxpdHkSFwoTQ0FSRElOQUxJVFlfVU5LTk9XThAAEhgKFENBUkRJTkFMSVRZX09QVElPTkFMEAESGAoUQ0FSRElOQUxJVFlfUkVRVUlSRUQQAhIYChRDQVJESU5BTElUWV9SRVBFQVRFRBADIt8BCgRFbnVtEgwKBG5hbWUYASABKAkSLQoJZW51bXZhbHVlGAIgAygLMhouZ29vZ2xlLnByb3RvYnVmLkVudW1WYWx1ZRIoCgdvcHRpb25zGAMgAygLMhcuZ29vZ2xlLnByb3RvYnVmLk9wdGlvbhI2Cg5zb3VyY2VfY29udGV4dBgEIAEoCzIeLmdvb2dsZS5wcm90b2J1Zi5Tb3VyY2VDb250ZXh0EicKBnN5bnRheBgFIAEoDjIXLmdvb2dsZS5wcm90b2J1Zi5TeW50YXgSDwoHZWRpdGlvbhgGIAEoCSJTCglFbnVtVmFsdWUSDAoEbmFtZRgBIAEoCRIOCgZudW1iZXIYAiABKAUSKAoHb3B0aW9ucxgDIAMoCzIXLmdvb2dsZS5wcm90b2J1Zi5PcHRpb24iOwoGT3B0aW9uEgwKBG5hbWUYASABKAkSIwoFdmFsdWUYAiABKAsyFC5nb29nbGUucHJvdG9idWYuQW55KkMKBlN5bnRheBIRCg1TWU5UQVhfUFJPVE8yEAASEQoNU1lOVEFYX1BST1RPMxABEhMKD1NZTlRBWF9FRElUSU9OUxACQnsKE2NvbS5nb29nbGUucHJvdG9idWZCCVR5cGVQcm90b1ABWi1nb29nbGUuZ29sYW5nLm9yZy9wcm90b2J1Zi90eXBlcy9rbm93bi90eXBlcGL4AQGiAgNHUEKqAh5Hb29nbGUuUHJvdG9idWYuV2VsbEtub3duVHlwZXNiBnByb3RvMw", [any_pb_js_1.file_google_protobuf_any, source_context_pb_js_1.file_google_protobuf_source_context]);
    exports.TypeSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_type, 0);
    exports.FieldSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_type, 1);
    var Field_Kind;
    (function(Field_Kind2) {
      Field_Kind2[Field_Kind2.TYPE_UNKNOWN = 0] = "TYPE_UNKNOWN", Field_Kind2[Field_Kind2.TYPE_DOUBLE = 1] = "TYPE_DOUBLE", Field_Kind2[Field_Kind2.TYPE_FLOAT = 2] = "TYPE_FLOAT", Field_Kind2[Field_Kind2.TYPE_INT64 = 3] = "TYPE_INT64", Field_Kind2[Field_Kind2.TYPE_UINT64 = 4] = "TYPE_UINT64", Field_Kind2[Field_Kind2.TYPE_INT32 = 5] = "TYPE_INT32", Field_Kind2[Field_Kind2.TYPE_FIXED64 = 6] = "TYPE_FIXED64", Field_Kind2[Field_Kind2.TYPE_FIXED32 = 7] = "TYPE_FIXED32", Field_Kind2[Field_Kind2.TYPE_BOOL = 8] = "TYPE_BOOL", Field_Kind2[Field_Kind2.TYPE_STRING = 9] = "TYPE_STRING", Field_Kind2[Field_Kind2.TYPE_GROUP = 10] = "TYPE_GROUP", Field_Kind2[Field_Kind2.TYPE_MESSAGE = 11] = "TYPE_MESSAGE", Field_Kind2[Field_Kind2.TYPE_BYTES = 12] = "TYPE_BYTES", Field_Kind2[Field_Kind2.TYPE_UINT32 = 13] = "TYPE_UINT32", Field_Kind2[Field_Kind2.TYPE_ENUM = 14] = "TYPE_ENUM", Field_Kind2[Field_Kind2.TYPE_SFIXED32 = 15] = "TYPE_SFIXED32", Field_Kind2[Field_Kind2.TYPE_SFIXED64 = 16] = "TYPE_SFIXED64", Field_Kind2[Field_Kind2.TYPE_SINT32 = 17] = "TYPE_SINT32", Field_Kind2[Field_Kind2.TYPE_SINT64 = 18] = "TYPE_SINT64";
    })(Field_Kind || (exports.Field_Kind = Field_Kind = {}));
    exports.Field_KindSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_type, 1, 0);
    var Field_Cardinality;
    (function(Field_Cardinality2) {
      Field_Cardinality2[Field_Cardinality2.UNKNOWN = 0] = "UNKNOWN", Field_Cardinality2[Field_Cardinality2.OPTIONAL = 1] = "OPTIONAL", Field_Cardinality2[Field_Cardinality2.REQUIRED = 2] = "REQUIRED", Field_Cardinality2[Field_Cardinality2.REPEATED = 3] = "REPEATED";
    })(Field_Cardinality || (exports.Field_Cardinality = Field_Cardinality = {}));
    exports.Field_CardinalitySchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_type, 1, 1);
    exports.EnumSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_type, 2);
    exports.EnumValueSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_type, 3);
    exports.OptionSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_type, 4);
    var Syntax;
    (function(Syntax2) {
      Syntax2[Syntax2.PROTO2 = 0] = "PROTO2", Syntax2[Syntax2.PROTO3 = 1] = "PROTO3", Syntax2[Syntax2.EDITIONS = 2] = "EDITIONS";
    })(Syntax || (exports.Syntax = Syntax = {}));
    exports.SyntaxSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_type, 0);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/api_pb.js
var require_api_pb = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/api_pb.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.MixinSchema = exports.MethodSchema = exports.ApiSchema = exports.file_google_protobuf_api = void 0;
    var file_js_1 = require_file(), source_context_pb_js_1 = require_source_context_pb(), type_pb_js_1 = require_type_pb(), message_js_1 = require_message2();
    exports.file_google_protobuf_api = (0, file_js_1.fileDesc)("Chlnb29nbGUvcHJvdG9idWYvYXBpLnByb3RvEg9nb29nbGUucHJvdG9idWYikgIKA0FwaRIMCgRuYW1lGAEgASgJEigKB21ldGhvZHMYAiADKAsyFy5nb29nbGUucHJvdG9idWYuTWV0aG9kEigKB29wdGlvbnMYAyADKAsyFy5nb29nbGUucHJvdG9idWYuT3B0aW9uEg8KB3ZlcnNpb24YBCABKAkSNgoOc291cmNlX2NvbnRleHQYBSABKAsyHi5nb29nbGUucHJvdG9idWYuU291cmNlQ29udGV4dBImCgZtaXhpbnMYBiADKAsyFi5nb29nbGUucHJvdG9idWYuTWl4aW4SJwoGc3ludGF4GAcgASgOMhcuZ29vZ2xlLnByb3RvYnVmLlN5bnRheBIPCgdlZGl0aW9uGAggASgJIu4BCgZNZXRob2QSDAoEbmFtZRgBIAEoCRIYChByZXF1ZXN0X3R5cGVfdXJsGAIgASgJEhkKEXJlcXVlc3Rfc3RyZWFtaW5nGAMgASgIEhkKEXJlc3BvbnNlX3R5cGVfdXJsGAQgASgJEhoKEnJlc3BvbnNlX3N0cmVhbWluZxgFIAEoCBIoCgdvcHRpb25zGAYgAygLMhcuZ29vZ2xlLnByb3RvYnVmLk9wdGlvbhIrCgZzeW50YXgYByABKA4yFy5nb29nbGUucHJvdG9idWYuU3ludGF4QgIYARITCgdlZGl0aW9uGAggASgJQgIYASIjCgVNaXhpbhIMCgRuYW1lGAEgASgJEgwKBHJvb3QYAiABKAlCdgoTY29tLmdvb2dsZS5wcm90b2J1ZkIIQXBpUHJvdG9QAVosZ29vZ2xlLmdvbGFuZy5vcmcvcHJvdG9idWYvdHlwZXMva25vd24vYXBpcGKiAgNHUEKqAh5Hb29nbGUuUHJvdG9idWYuV2VsbEtub3duVHlwZXNiBnByb3RvMw", [source_context_pb_js_1.file_google_protobuf_source_context, type_pb_js_1.file_google_protobuf_type]);
    exports.ApiSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_api, 0);
    exports.MethodSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_api, 1);
    exports.MixinSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_api, 2);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/extension.js
var require_extension = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/extension.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.extDesc = extDesc;
    function extDesc(file, path, ...paths) {
      if (paths.length == 0)
        return file.extensions[path];
      let e = paths.pop();
      return paths.reduce((acc, cur) => acc.nestedMessages[cur], file.messages[path]).nestedExtensions[e];
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/cpp_features_pb.js
var require_cpp_features_pb = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/cpp_features_pb.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.cpp = exports.CppFeatures_StringTypeSchema = exports.CppFeatures_StringType = exports.CppFeaturesSchema = exports.file_google_protobuf_cpp_features = void 0;
    var file_js_1 = require_file(), descriptor_pb_js_1 = require_descriptor_pb(), message_js_1 = require_message2(), enum_js_1 = require_enum(), extension_js_1 = require_extension();
    exports.file_google_protobuf_cpp_features = (0, file_js_1.fileDesc)("CiJnb29nbGUvcHJvdG9idWYvY3BwX2ZlYXR1cmVzLnByb3RvEgJwYiL8AwoLQ3BwRmVhdHVyZXMS+wEKEmxlZ2FjeV9jbG9zZWRfZW51bRgBIAEoCELeAYgBAZgBBJgBAaIBCRIEdHJ1ZRiEB6IBChIFZmFsc2UY5weyAbgBCOgHEOgHGq8BVGhlIGxlZ2FjeSBjbG9zZWQgZW51bSBiZWhhdmlvciBpbiBDKysgaXMgZGVwcmVjYXRlZCBhbmQgaXMgc2NoZWR1bGVkIHRvIGJlIHJlbW92ZWQgaW4gZWRpdGlvbiAyMDI1LiAgU2VlIGh0dHA6Ly9wcm90b2J1Zi5kZXYvcHJvZ3JhbW1pbmctZ3VpZGVzL2VudW0vI2NwcCBmb3IgbW9yZSBpbmZvcm1hdGlvbhJaCgtzdHJpbmdfdHlwZRgCIAEoDjIaLnBiLkNwcEZlYXR1cmVzLlN0cmluZ1R5cGVCKYgBAZgBBJgBAaIBCxIGU1RSSU5HGIQHogEJEgRWSUVXGOkHsgEDCOgHEkwKGmVudW1fbmFtZV91c2VzX3N0cmluZ192aWV3GAMgASgIQiiIAQGYAQaYAQGiAQoSBWZhbHNlGIQHogEJEgR0cnVlGOkHsgEDCOkHIkUKClN0cmluZ1R5cGUSFwoTU1RSSU5HX1RZUEVfVU5LTk9XThAAEggKBFZJRVcQARIICgRDT1JEEAISCgoGU1RSSU5HEAM6PwoDY3BwEhsuZ29vZ2xlLnByb3RvYnVmLkZlYXR1cmVTZXQY6AcgASgLMg8ucGIuQ3BwRmVhdHVyZXNSA2NwcA", [descriptor_pb_js_1.file_google_protobuf_descriptor]);
    exports.CppFeaturesSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_cpp_features, 0);
    var CppFeatures_StringType;
    (function(CppFeatures_StringType2) {
      CppFeatures_StringType2[CppFeatures_StringType2.STRING_TYPE_UNKNOWN = 0] = "STRING_TYPE_UNKNOWN", CppFeatures_StringType2[CppFeatures_StringType2.VIEW = 1] = "VIEW", CppFeatures_StringType2[CppFeatures_StringType2.CORD = 2] = "CORD", CppFeatures_StringType2[CppFeatures_StringType2.STRING = 3] = "STRING";
    })(CppFeatures_StringType || (exports.CppFeatures_StringType = CppFeatures_StringType = {}));
    exports.CppFeatures_StringTypeSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_cpp_features, 0, 0);
    exports.cpp = (0, extension_js_1.extDesc)(exports.file_google_protobuf_cpp_features, 0);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/empty_pb.js
var require_empty_pb = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/empty_pb.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.EmptySchema = exports.file_google_protobuf_empty = void 0;
    var file_js_1 = require_file(), message_js_1 = require_message2();
    exports.file_google_protobuf_empty = (0, file_js_1.fileDesc)("Chtnb29nbGUvcHJvdG9idWYvZW1wdHkucHJvdG8SD2dvb2dsZS5wcm90b2J1ZiIHCgVFbXB0eUJ9ChNjb20uZ29vZ2xlLnByb3RvYnVmQgpFbXB0eVByb3RvUAFaLmdvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL2VtcHR5cGL4AQGiAgNHUEKqAh5Hb29nbGUuUHJvdG9idWYuV2VsbEtub3duVHlwZXNiBnByb3RvMw");
    exports.EmptySchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_empty, 0);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/field_mask_pb.js
var require_field_mask_pb = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/field_mask_pb.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.FieldMaskSchema = exports.file_google_protobuf_field_mask = void 0;
    var file_js_1 = require_file(), message_js_1 = require_message2();
    exports.file_google_protobuf_field_mask = (0, file_js_1.fileDesc)("CiBnb29nbGUvcHJvdG9idWYvZmllbGRfbWFzay5wcm90bxIPZ29vZ2xlLnByb3RvYnVmIhoKCUZpZWxkTWFzaxINCgVwYXRocxgBIAMoCUKFAQoTY29tLmdvb2dsZS5wcm90b2J1ZkIORmllbGRNYXNrUHJvdG9QAVoyZ29vZ2xlLmdvbGFuZy5vcmcvcHJvdG9idWYvdHlwZXMva25vd24vZmllbGRtYXNrcGL4AQGiAgNHUEKqAh5Hb29nbGUuUHJvdG9idWYuV2VsbEtub3duVHlwZXNiBnByb3RvMw");
    exports.FieldMaskSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_field_mask, 0);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/go_features_pb.js
var require_go_features_pb = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/go_features_pb.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.go = exports.GoFeatures_StripEnumPrefixSchema = exports.GoFeatures_StripEnumPrefix = exports.GoFeatures_APILevelSchema = exports.GoFeatures_APILevel = exports.GoFeatures_OptimizeModeFeature_OptimizeModeSchema = exports.GoFeatures_OptimizeModeFeature_OptimizeMode = exports.GoFeatures_OptimizeModeFeatureSchema = exports.GoFeaturesSchema = exports.file_google_protobuf_go_features = void 0;
    var file_js_1 = require_file(), descriptor_pb_js_1 = require_descriptor_pb(), message_js_1 = require_message2(), enum_js_1 = require_enum(), extension_js_1 = require_extension();
    exports.file_google_protobuf_go_features = (0, file_js_1.fileDesc)("CiFnb29nbGUvcHJvdG9idWYvZ29fZmVhdHVyZXMucHJvdG8SAnBiItEGCgpHb0ZlYXR1cmVzEqUBChpsZWdhY3lfdW5tYXJzaGFsX2pzb25fZW51bRgBIAEoCEKAAYgBAZgBBpgBAaIBCRIEdHJ1ZRiEB6IBChIFZmFsc2UY5weyAVsI6AcQ6AcaU1RoZSBsZWdhY3kgVW5tYXJzaGFsSlNPTiBBUEkgaXMgZGVwcmVjYXRlZCBhbmQgd2lsbCBiZSByZW1vdmVkIGluIGEgZnV0dXJlIGVkaXRpb24uEmoKCWFwaV9sZXZlbBgCIAEoDjIXLnBiLkdvRmVhdHVyZXMuQVBJTGV2ZWxCPogBAZgBA5gBAaIBGhIVQVBJX0xFVkVMX1VOU1BFQ0lGSUVEGIQHogEPEgpBUElfT1BBUVVFGOkHsgEDCOgHEmsKEXN0cmlwX2VudW1fcHJlZml4GAMgASgOMh4ucGIuR29GZWF0dXJlcy5TdHJpcEVudW1QcmVmaXhCMIgBAZgBBpgBB5gBAaIBGxIWU1RSSVBfRU5VTV9QUkVGSVhfS0VFUBiEB7IBAwjpBxJ4Cg1vcHRpbWl6ZV9tb2RlGAQgASgOMi8ucGIuR29GZWF0dXJlcy5PcHRpbWl6ZU1vZGVGZWF0dXJlLk9wdGltaXplTW9kZUIwiAEBmAEDmAEBogEeEhlPUFRJTUlaRV9NT0RFX1VOU1BFQ0lGSUVEGIQHsgEDCOkHGl4KE09wdGltaXplTW9kZUZlYXR1cmUiRwoMT3B0aW1pemVNb2RlEh0KGU9QVElNSVpFX01PREVfVU5TUEVDSUZJRUQQABIJCgVTUEVFRBABEg0KCUNPREVfU0laRRACIlMKCEFQSUxldmVsEhkKFUFQSV9MRVZFTF9VTlNQRUNJRklFRBAAEgwKCEFQSV9PUEVOEAESDgoKQVBJX0hZQlJJRBACEg4KCkFQSV9PUEFRVUUQAyKSAQoPU3RyaXBFbnVtUHJlZml4EiEKHVNUUklQX0VOVU1fUFJFRklYX1VOU1BFQ0lGSUVEEAASGgoWU1RSSVBfRU5VTV9QUkVGSVhfS0VFUBABEiMKH1NUUklQX0VOVU1fUFJFRklYX0dFTkVSQVRFX0JPVEgQAhIbChdTVFJJUF9FTlVNX1BSRUZJWF9TVFJJUBADOjwKAmdvEhsuZ29vZ2xlLnByb3RvYnVmLkZlYXR1cmVTZXQY6gcgASgLMg4ucGIuR29GZWF0dXJlc1ICZ29CL1otZ29vZ2xlLmdvbGFuZy5vcmcvcHJvdG9idWYvdHlwZXMvZ29mZWF0dXJlc3Bi", [descriptor_pb_js_1.file_google_protobuf_descriptor]);
    exports.GoFeaturesSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_go_features, 0);
    exports.GoFeatures_OptimizeModeFeatureSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_go_features, 0, 0);
    var GoFeatures_OptimizeModeFeature_OptimizeMode;
    (function(GoFeatures_OptimizeModeFeature_OptimizeMode2) {
      GoFeatures_OptimizeModeFeature_OptimizeMode2[GoFeatures_OptimizeModeFeature_OptimizeMode2.OPTIMIZE_MODE_UNSPECIFIED = 0] = "OPTIMIZE_MODE_UNSPECIFIED", GoFeatures_OptimizeModeFeature_OptimizeMode2[GoFeatures_OptimizeModeFeature_OptimizeMode2.SPEED = 1] = "SPEED", GoFeatures_OptimizeModeFeature_OptimizeMode2[GoFeatures_OptimizeModeFeature_OptimizeMode2.CODE_SIZE = 2] = "CODE_SIZE";
    })(GoFeatures_OptimizeModeFeature_OptimizeMode || (exports.GoFeatures_OptimizeModeFeature_OptimizeMode = GoFeatures_OptimizeModeFeature_OptimizeMode = {}));
    exports.GoFeatures_OptimizeModeFeature_OptimizeModeSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_go_features, 0, 0, 0);
    var GoFeatures_APILevel;
    (function(GoFeatures_APILevel2) {
      GoFeatures_APILevel2[GoFeatures_APILevel2.API_LEVEL_UNSPECIFIED = 0] = "API_LEVEL_UNSPECIFIED", GoFeatures_APILevel2[GoFeatures_APILevel2.API_OPEN = 1] = "API_OPEN", GoFeatures_APILevel2[GoFeatures_APILevel2.API_HYBRID = 2] = "API_HYBRID", GoFeatures_APILevel2[GoFeatures_APILevel2.API_OPAQUE = 3] = "API_OPAQUE";
    })(GoFeatures_APILevel || (exports.GoFeatures_APILevel = GoFeatures_APILevel = {}));
    exports.GoFeatures_APILevelSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_go_features, 0, 0);
    var GoFeatures_StripEnumPrefix;
    (function(GoFeatures_StripEnumPrefix2) {
      GoFeatures_StripEnumPrefix2[GoFeatures_StripEnumPrefix2.UNSPECIFIED = 0] = "UNSPECIFIED", GoFeatures_StripEnumPrefix2[GoFeatures_StripEnumPrefix2.KEEP = 1] = "KEEP", GoFeatures_StripEnumPrefix2[GoFeatures_StripEnumPrefix2.GENERATE_BOTH = 2] = "GENERATE_BOTH", GoFeatures_StripEnumPrefix2[GoFeatures_StripEnumPrefix2.STRIP = 3] = "STRIP";
    })(GoFeatures_StripEnumPrefix || (exports.GoFeatures_StripEnumPrefix = GoFeatures_StripEnumPrefix = {}));
    exports.GoFeatures_StripEnumPrefixSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_go_features, 0, 1);
    exports.go = (0, extension_js_1.extDesc)(exports.file_google_protobuf_go_features, 0);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/java_features_pb.js
var require_java_features_pb = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/java_features_pb.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.java = exports.JavaFeatures_Utf8ValidationSchema = exports.JavaFeatures_Utf8Validation = exports.JavaFeatures_NestInFileClassFeature_NestInFileClassSchema = exports.JavaFeatures_NestInFileClassFeature_NestInFileClass = exports.JavaFeatures_NestInFileClassFeatureSchema = exports.JavaFeaturesSchema = exports.file_google_protobuf_java_features = void 0;
    var file_js_1 = require_file(), descriptor_pb_js_1 = require_descriptor_pb(), message_js_1 = require_message2(), enum_js_1 = require_enum(), extension_js_1 = require_extension();
    exports.file_google_protobuf_java_features = (0, file_js_1.fileDesc)("CiNnb29nbGUvcHJvdG9idWYvamF2YV9mZWF0dXJlcy5wcm90bxICcGIigwgKDEphdmFGZWF0dXJlcxL+AQoSbGVnYWN5X2Nsb3NlZF9lbnVtGAEgASgIQuEBiAEBmAEEmAEBogEJEgR0cnVlGIQHogEKEgVmYWxzZRjnB7IBuwEI6AcQ6AcasgFUaGUgbGVnYWN5IGNsb3NlZCBlbnVtIGJlaGF2aW9yIGluIEphdmEgaXMgZGVwcmVjYXRlZCBhbmQgaXMgc2NoZWR1bGVkIHRvIGJlIHJlbW92ZWQgaW4gZWRpdGlvbiAyMDI1LiAgU2VlIGh0dHA6Ly9wcm90b2J1Zi5kZXYvcHJvZ3JhbW1pbmctZ3VpZGVzL2VudW0vI2phdmEgZm9yIG1vcmUgaW5mb3JtYXRpb24uEp8CCg91dGY4X3ZhbGlkYXRpb24YAiABKA4yHy5wYi5KYXZhRmVhdHVyZXMuVXRmOFZhbGlkYXRpb25C5AGIAQGYAQSYAQGiAQwSB0RFRkFVTFQYhAeyAcgBCOgHEOkHGr8BVGhlIEphdmEtc3BlY2lmaWMgdXRmOCB2YWxpZGF0aW9uIGZlYXR1cmUgaXMgZGVwcmVjYXRlZCBhbmQgaXMgc2NoZWR1bGVkIHRvIGJlIHJlbW92ZWQgaW4gZWRpdGlvbiAyMDI1LiAgVXRmOCB2YWxpZGF0aW9uIGJlaGF2aW9yIHNob3VsZCB1c2UgdGhlIGdsb2JhbCBjcm9zcy1sYW5ndWFnZSB1dGY4X3ZhbGlkYXRpb24gZmVhdHVyZS4SMAoKbGFyZ2VfZW51bRgDIAEoCEIciAEBmAEGmAEBogEKEgVmYWxzZRiEB7IBAwjpBxJRCh91c2Vfb2xkX291dGVyX2NsYXNzbmFtZV9kZWZhdWx0GAQgASgIQiiIAQGYAQGiAQkSBHRydWUYhAeiAQoSBWZhbHNlGOkHsgEGCOkHIOkHEn8KEm5lc3RfaW5fZmlsZV9jbGFzcxgFIAEoDjI3LnBiLkphdmFGZWF0dXJlcy5OZXN0SW5GaWxlQ2xhc3NGZWF0dXJlLk5lc3RJbkZpbGVDbGFzc0IqiAEBmAEDmAEGmAEIogELEgZMRUdBQ1kYhAeiAQcSAk5PGOkHsgEDCOkHGnwKFk5lc3RJbkZpbGVDbGFzc0ZlYXR1cmUiWAoPTmVzdEluRmlsZUNsYXNzEh4KGk5FU1RfSU5fRklMRV9DTEFTU19VTktOT1dOEAASBgoCTk8QARIHCgNZRVMQAhIUCgZMRUdBQ1kQAxoIIgYI6Qcg6QdKCAgBEICAgIACIkYKDlV0ZjhWYWxpZGF0aW9uEhsKF1VURjhfVkFMSURBVElPTl9VTktOT1dOEAASCwoHREVGQVVMVBABEgoKBlZFUklGWRACSgQIBhAHOkIKBGphdmESGy5nb29nbGUucHJvdG9idWYuRmVhdHVyZVNldBjpByABKAsyEC5wYi5KYXZhRmVhdHVyZXNSBGphdmFCKAoTY29tLmdvb2dsZS5wcm90b2J1ZkIRSmF2YUZlYXR1cmVzUHJvdG8", [descriptor_pb_js_1.file_google_protobuf_descriptor]);
    exports.JavaFeaturesSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_java_features, 0);
    exports.JavaFeatures_NestInFileClassFeatureSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_java_features, 0, 0);
    var JavaFeatures_NestInFileClassFeature_NestInFileClass;
    (function(JavaFeatures_NestInFileClassFeature_NestInFileClass2) {
      JavaFeatures_NestInFileClassFeature_NestInFileClass2[JavaFeatures_NestInFileClassFeature_NestInFileClass2.NEST_IN_FILE_CLASS_UNKNOWN = 0] = "NEST_IN_FILE_CLASS_UNKNOWN", JavaFeatures_NestInFileClassFeature_NestInFileClass2[JavaFeatures_NestInFileClassFeature_NestInFileClass2.NO = 1] = "NO", JavaFeatures_NestInFileClassFeature_NestInFileClass2[JavaFeatures_NestInFileClassFeature_NestInFileClass2.YES = 2] = "YES", JavaFeatures_NestInFileClassFeature_NestInFileClass2[JavaFeatures_NestInFileClassFeature_NestInFileClass2.LEGACY = 3] = "LEGACY";
    })(JavaFeatures_NestInFileClassFeature_NestInFileClass || (exports.JavaFeatures_NestInFileClassFeature_NestInFileClass = JavaFeatures_NestInFileClassFeature_NestInFileClass = {}));
    exports.JavaFeatures_NestInFileClassFeature_NestInFileClassSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_java_features, 0, 0, 0);
    var JavaFeatures_Utf8Validation;
    (function(JavaFeatures_Utf8Validation2) {
      JavaFeatures_Utf8Validation2[JavaFeatures_Utf8Validation2.UTF8_VALIDATION_UNKNOWN = 0] = "UTF8_VALIDATION_UNKNOWN", JavaFeatures_Utf8Validation2[JavaFeatures_Utf8Validation2.DEFAULT = 1] = "DEFAULT", JavaFeatures_Utf8Validation2[JavaFeatures_Utf8Validation2.VERIFY = 2] = "VERIFY";
    })(JavaFeatures_Utf8Validation || (exports.JavaFeatures_Utf8Validation = JavaFeatures_Utf8Validation = {}));
    exports.JavaFeatures_Utf8ValidationSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_java_features, 0, 0);
    exports.java = (0, extension_js_1.extDesc)(exports.file_google_protobuf_java_features, 0);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/struct_pb.js
var require_struct_pb = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/struct_pb.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.NullValueSchema = exports.NullValue = exports.ListValueSchema = exports.ValueSchema = exports.StructSchema = exports.file_google_protobuf_struct = void 0;
    var file_js_1 = require_file(), message_js_1 = require_message2(), enum_js_1 = require_enum();
    exports.file_google_protobuf_struct = (0, file_js_1.fileDesc)("Chxnb29nbGUvcHJvdG9idWYvc3RydWN0LnByb3RvEg9nb29nbGUucHJvdG9idWYihAEKBlN0cnVjdBIzCgZmaWVsZHMYASADKAsyIy5nb29nbGUucHJvdG9idWYuU3RydWN0LkZpZWxkc0VudHJ5GkUKC0ZpZWxkc0VudHJ5EgsKA2tleRgBIAEoCRIlCgV2YWx1ZRgCIAEoCzIWLmdvb2dsZS5wcm90b2J1Zi5WYWx1ZToCOAEi6gEKBVZhbHVlEjAKCm51bGxfdmFsdWUYASABKA4yGi5nb29nbGUucHJvdG9idWYuTnVsbFZhbHVlSAASFgoMbnVtYmVyX3ZhbHVlGAIgASgBSAASFgoMc3RyaW5nX3ZhbHVlGAMgASgJSAASFAoKYm9vbF92YWx1ZRgEIAEoCEgAEi8KDHN0cnVjdF92YWx1ZRgFIAEoCzIXLmdvb2dsZS5wcm90b2J1Zi5TdHJ1Y3RIABIwCgpsaXN0X3ZhbHVlGAYgASgLMhouZ29vZ2xlLnByb3RvYnVmLkxpc3RWYWx1ZUgAQgYKBGtpbmQiMwoJTGlzdFZhbHVlEiYKBnZhbHVlcxgBIAMoCzIWLmdvb2dsZS5wcm90b2J1Zi5WYWx1ZSobCglOdWxsVmFsdWUSDgoKTlVMTF9WQUxVRRAAQn8KE2NvbS5nb29nbGUucHJvdG9idWZCC1N0cnVjdFByb3RvUAFaL2dvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL3N0cnVjdHBi+AEBogIDR1BCqgIeR29vZ2xlLlByb3RvYnVmLldlbGxLbm93blR5cGVzYgZwcm90bzM");
    exports.StructSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_struct, 0);
    exports.ValueSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_struct, 1);
    exports.ListValueSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_struct, 2);
    var NullValue;
    (function(NullValue2) {
      NullValue2[NullValue2.NULL_VALUE = 0] = "NULL_VALUE";
    })(NullValue || (exports.NullValue = NullValue = {}));
    exports.NullValueSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_struct, 0);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/wrappers_pb.js
var require_wrappers_pb = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/wrappers_pb.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.BytesValueSchema = exports.StringValueSchema = exports.BoolValueSchema = exports.UInt32ValueSchema = exports.Int32ValueSchema = exports.UInt64ValueSchema = exports.Int64ValueSchema = exports.FloatValueSchema = exports.DoubleValueSchema = exports.file_google_protobuf_wrappers = void 0;
    var file_js_1 = require_file(), message_js_1 = require_message2();
    exports.file_google_protobuf_wrappers = (0, file_js_1.fileDesc)("Ch5nb29nbGUvcHJvdG9idWYvd3JhcHBlcnMucHJvdG8SD2dvb2dsZS5wcm90b2J1ZiIcCgtEb3VibGVWYWx1ZRINCgV2YWx1ZRgBIAEoASIbCgpGbG9hdFZhbHVlEg0KBXZhbHVlGAEgASgCIhsKCkludDY0VmFsdWUSDQoFdmFsdWUYASABKAMiHAoLVUludDY0VmFsdWUSDQoFdmFsdWUYASABKAQiGwoKSW50MzJWYWx1ZRINCgV2YWx1ZRgBIAEoBSIcCgtVSW50MzJWYWx1ZRINCgV2YWx1ZRgBIAEoDSIaCglCb29sVmFsdWUSDQoFdmFsdWUYASABKAgiHAoLU3RyaW5nVmFsdWUSDQoFdmFsdWUYASABKAkiGwoKQnl0ZXNWYWx1ZRINCgV2YWx1ZRgBIAEoDEKDAQoTY29tLmdvb2dsZS5wcm90b2J1ZkINV3JhcHBlcnNQcm90b1ABWjFnb29nbGUuZ29sYW5nLm9yZy9wcm90b2J1Zi90eXBlcy9rbm93bi93cmFwcGVyc3Bi+AEBogIDR1BCqgIeR29vZ2xlLlByb3RvYnVmLldlbGxLbm93blR5cGVzYgZwcm90bzM");
    exports.DoubleValueSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_wrappers, 0);
    exports.FloatValueSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_wrappers, 1);
    exports.Int64ValueSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_wrappers, 2);
    exports.UInt64ValueSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_wrappers, 3);
    exports.Int32ValueSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_wrappers, 4);
    exports.UInt32ValueSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_wrappers, 5);
    exports.BoolValueSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_wrappers, 6);
    exports.StringValueSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_wrappers, 7);
    exports.BytesValueSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_wrappers, 8);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/compiler/plugin_pb.js
var require_plugin_pb = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/gen/google/protobuf/compiler/plugin_pb.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.CodeGeneratorResponse_FeatureSchema = exports.CodeGeneratorResponse_Feature = exports.CodeGeneratorResponse_FileSchema = exports.CodeGeneratorResponseSchema = exports.CodeGeneratorRequestSchema = exports.VersionSchema = exports.file_google_protobuf_compiler_plugin = void 0;
    var file_js_1 = require_file(), descriptor_pb_js_1 = require_descriptor_pb(), message_js_1 = require_message2(), enum_js_1 = require_enum();
    exports.file_google_protobuf_compiler_plugin = (0, file_js_1.fileDesc)("CiVnb29nbGUvcHJvdG9idWYvY29tcGlsZXIvcGx1Z2luLnByb3RvEhhnb29nbGUucHJvdG9idWYuY29tcGlsZXIiRgoHVmVyc2lvbhINCgVtYWpvchgBIAEoBRINCgVtaW5vchgCIAEoBRINCgVwYXRjaBgDIAEoBRIOCgZzdWZmaXgYBCABKAkigQIKFENvZGVHZW5lcmF0b3JSZXF1ZXN0EhgKEGZpbGVfdG9fZ2VuZXJhdGUYASADKAkSEQoJcGFyYW1ldGVyGAIgASgJEjgKCnByb3RvX2ZpbGUYDyADKAsyJC5nb29nbGUucHJvdG9idWYuRmlsZURlc2NyaXB0b3JQcm90bxJFChdzb3VyY2VfZmlsZV9kZXNjcmlwdG9ycxgRIAMoCzIkLmdvb2dsZS5wcm90b2J1Zi5GaWxlRGVzY3JpcHRvclByb3RvEjsKEGNvbXBpbGVyX3ZlcnNpb24YAyABKAsyIS5nb29nbGUucHJvdG9idWYuY29tcGlsZXIuVmVyc2lvbiKSAwoVQ29kZUdlbmVyYXRvclJlc3BvbnNlEg0KBWVycm9yGAEgASgJEhoKEnN1cHBvcnRlZF9mZWF0dXJlcxgCIAEoBBIXCg9taW5pbXVtX2VkaXRpb24YAyABKAUSFwoPbWF4aW11bV9lZGl0aW9uGAQgASgFEkIKBGZpbGUYDyADKAsyNC5nb29nbGUucHJvdG9idWYuY29tcGlsZXIuQ29kZUdlbmVyYXRvclJlc3BvbnNlLkZpbGUafwoERmlsZRIMCgRuYW1lGAEgASgJEhcKD2luc2VydGlvbl9wb2ludBgCIAEoCRIPCgdjb250ZW50GA8gASgJEj8KE2dlbmVyYXRlZF9jb2RlX2luZm8YECABKAsyIi5nb29nbGUucHJvdG9idWYuR2VuZXJhdGVkQ29kZUluZm8iVwoHRmVhdHVyZRIQCgxGRUFUVVJFX05PTkUQABIbChdGRUFUVVJFX1BST1RPM19PUFRJT05BTBABEh0KGUZFQVRVUkVfU1VQUE9SVFNfRURJVElPTlMQAkJyChxjb20uZ29vZ2xlLnByb3RvYnVmLmNvbXBpbGVyQgxQbHVnaW5Qcm90b3NaKWdvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL3BsdWdpbnBiqgIYR29vZ2xlLlByb3RvYnVmLkNvbXBpbGVy", [descriptor_pb_js_1.file_google_protobuf_descriptor]);
    exports.VersionSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_compiler_plugin, 0);
    exports.CodeGeneratorRequestSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_compiler_plugin, 1);
    exports.CodeGeneratorResponseSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_compiler_plugin, 2);
    exports.CodeGeneratorResponse_FileSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_compiler_plugin, 2, 0);
    var CodeGeneratorResponse_Feature;
    (function(CodeGeneratorResponse_Feature2) {
      CodeGeneratorResponse_Feature2[CodeGeneratorResponse_Feature2.NONE = 0] = "NONE", CodeGeneratorResponse_Feature2[CodeGeneratorResponse_Feature2.PROTO3_OPTIONAL = 1] = "PROTO3_OPTIONAL", CodeGeneratorResponse_Feature2[CodeGeneratorResponse_Feature2.SUPPORTS_EDITIONS = 2] = "SUPPORTS_EDITIONS";
    })(CodeGeneratorResponse_Feature || (exports.CodeGeneratorResponse_Feature = CodeGeneratorResponse_Feature = {}));
    exports.CodeGeneratorResponse_FeatureSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_compiler_plugin, 2, 0);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/index.js
var require_wkt = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      k2 === void 0 && (k2 = k);
      var desc = Object.getOwnPropertyDescriptor(m, k);
      (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) && (desc = { enumerable: !0, get: function() {
        return m[k];
      } }), Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      k2 === void 0 && (k2 = k), o[k2] = m[k];
    })), __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p) && __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: !0 });
    __exportStar(require_timestamp(), exports);
    __exportStar(require_duration(), exports);
    __exportStar(require_any(), exports);
    __exportStar(require_wrappers(), exports);
    __exportStar(require_any_pb(), exports);
    __exportStar(require_api_pb(), exports);
    __exportStar(require_cpp_features_pb(), exports);
    __exportStar(require_descriptor_pb(), exports);
    __exportStar(require_duration_pb(), exports);
    __exportStar(require_empty_pb(), exports);
    __exportStar(require_field_mask_pb(), exports);
    __exportStar(require_go_features_pb(), exports);
    __exportStar(require_java_features_pb(), exports);
    __exportStar(require_source_context_pb(), exports);
    __exportStar(require_struct_pb(), exports);
    __exportStar(require_timestamp_pb(), exports);
    __exportStar(require_type_pb(), exports);
    __exportStar(require_wrappers_pb(), exports);
    __exportStar(require_plugin_pb(), exports);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/extensions.js
var require_extensions = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/extensions.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.getExtension = getExtension;
    exports.setExtension = setExtension;
    exports.clearExtension = clearExtension;
    exports.hasExtension = hasExtension;
    exports.hasOption = hasOption;
    exports.getOption = getOption;
    exports.createExtensionContainer = createExtensionContainer;
    var create_js_1 = require_create(), from_binary_js_1 = require_from_binary(), reflect_js_1 = require_reflect(), scalar_js_1 = require_scalar(), to_binary_js_1 = require_to_binary(), binary_encoding_js_1 = require_binary_encoding(), wrappers_js_1 = require_wrappers();
    function getExtension(message, extension, options) {
      assertExtendee(extension, message);
      let ufs = filterUnknownFields(message.$unknown, extension), [container, field, get] = createExtensionContainer(extension), ctx = (0, from_binary_js_1.makeReadContext)(options);
      for (let uf of ufs)
        (0, from_binary_js_1.readField)(container, new binary_encoding_js_1.BinaryReader(uf.data), field, uf.wireType, ctx);
      return get();
    }
    function setExtension(message, extension, value) {
      var _a;
      assertExtendee(extension, message);
      let ufs = ((_a = message.$unknown) !== null && _a !== void 0 ? _a : []).filter((uf) => uf.no !== extension.number), [container, field] = createExtensionContainer(extension, value), writer = new binary_encoding_js_1.BinaryWriter();
      (0, to_binary_js_1.writeField)(writer, { writeUnknownFields: !0 }, container, field);
      let reader = new binary_encoding_js_1.BinaryReader(writer.finish());
      for (; reader.pos < reader.len; ) {
        let [no, wireType] = reader.tag(), data = reader.skip(wireType, no);
        ufs.push({ no, wireType, data });
      }
      message.$unknown = ufs;
    }
    function clearExtension(message, extension) {
      assertExtendee(extension, message), message.$unknown !== void 0 && (message.$unknown = message.$unknown.filter((uf) => uf.no !== extension.number));
    }
    function hasExtension(message, extension) {
      var _a;
      return extension.extendee.typeName === message.$typeName && !!(!((_a = message.$unknown) === null || _a === void 0) && _a.find((uf) => uf.no === extension.number));
    }
    function hasOption(element, option) {
      let message = element.proto.options;
      return message ? hasExtension(message, option) : !1;
    }
    function getOption(element, option) {
      let message = element.proto.options;
      if (!message) {
        let [, , get] = createExtensionContainer(option);
        return get();
      }
      return getExtension(message, option);
    }
    function filterUnknownFields(unknownFields, extension) {
      if (unknownFields === void 0)
        return [];
      if (extension.fieldKind === "enum" || extension.fieldKind === "scalar") {
        for (let i = unknownFields.length - 1; i >= 0; --i)
          if (unknownFields[i].no == extension.number)
            return [unknownFields[i]];
        return [];
      }
      return unknownFields.filter((uf) => uf.no === extension.number);
    }
    function createExtensionContainer(extension, value) {
      let localName = extension.typeName, field = Object.assign(Object.assign({}, extension), { kind: "field", parent: extension.extendee, localName }), desc = Object.assign(Object.assign({}, extension.extendee), { fields: [field], members: [field], oneofs: [] }), container = (0, create_js_1.create)(desc, value !== void 0 ? { [localName]: value } : void 0);
      return [
        (0, reflect_js_1.reflect)(desc, container),
        field,
        () => {
          let value2 = container[localName];
          if (value2 === void 0) {
            let desc2 = extension.message;
            return (0, wrappers_js_1.isWrapperDesc)(desc2) ? (0, scalar_js_1.scalarZeroValue)(desc2.fields[0].scalar, desc2.fields[0].longAsString) : (0, create_js_1.create)(desc2);
          }
          return value2;
        }
      ];
    }
    function assertExtendee(extension, message) {
      if (extension.extendee.typeName != message.$typeName)
        throw new Error(`extension ${extension.typeName} can only be applied to message ${extension.extendee.typeName}`);
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/equals.js
var require_equals = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/equals.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.equals = equals2;
    var scalar_js_1 = require_scalar(), reflect_js_1 = require_reflect(), descriptors_js_1 = require_descriptors(), index_js_1 = require_wkt(), extensions_js_1 = require_extensions();
    function equals2(schema, a, b, options) {
      return a.$typeName != schema.typeName || b.$typeName != schema.typeName ? !1 : a === b ? !0 : reflectEquals((0, reflect_js_1.reflect)(schema, a), (0, reflect_js_1.reflect)(schema, b), options);
    }
    function reflectEquals(a, b, opts) {
      if (a.desc.typeName === "google.protobuf.Any" && opts?.unpackAny == !0)
        return anyUnpackedEquals(a.message, b.message, opts);
      for (let f of a.fields)
        if (!fieldEquals(f, a, b, opts))
          return !1;
      return !(opts?.unknown == !0 && !unknownEquals(a, b, opts.registry) || opts?.extensions == !0 && !extensionsEquals(a, b, opts));
    }
    function fieldEquals(f, a, b, opts) {
      if (!a.isSet(f) && !b.isSet(f))
        return !0;
      if (!a.isSet(f) || !b.isSet(f))
        return !1;
      switch (f.fieldKind) {
        case "scalar":
          return (0, scalar_js_1.scalarEquals)(f.scalar, a.get(f), b.get(f));
        case "enum":
          return a.get(f) === b.get(f);
        case "message":
          return reflectEquals(a.get(f), b.get(f), opts);
        case "map": {
          let mapA = a.get(f), mapB = b.get(f), keys = [];
          for (let k of mapA.keys()) {
            if (!mapB.has(k))
              return !1;
            keys.push(k);
          }
          for (let k of mapB.keys())
            if (!mapA.has(k))
              return !1;
          for (let key of keys) {
            let va = mapA.get(key), vb = mapB.get(key);
            if (va !== vb)
              switch (f.mapKind) {
                case "enum":
                  return !1;
                case "message":
                  if (!reflectEquals(va, vb, opts))
                    return !1;
                  break;
                case "scalar":
                  if (!(0, scalar_js_1.scalarEquals)(f.scalar, va, vb))
                    return !1;
                  break;
              }
          }
          break;
        }
        case "list": {
          let listA = a.get(f), listB = b.get(f);
          if (listA.size != listB.size)
            return !1;
          for (let i = 0; i < listA.size; i++) {
            let va = listA.get(i), vb = listB.get(i);
            if (va !== vb)
              switch (f.listKind) {
                case "enum":
                  return !1;
                case "message":
                  if (!reflectEquals(va, vb, opts))
                    return !1;
                  break;
                case "scalar":
                  if (!(0, scalar_js_1.scalarEquals)(f.scalar, va, vb))
                    return !1;
                  break;
              }
          }
          break;
        }
      }
      return !0;
    }
    function anyUnpackedEquals(a, b, opts) {
      if (a.typeUrl !== b.typeUrl)
        return !1;
      let unpackedA = (0, index_js_1.anyUnpack)(a, opts.registry), unpackedB = (0, index_js_1.anyUnpack)(b, opts.registry);
      if (unpackedA && unpackedB) {
        let schema = opts.registry.getMessage(unpackedA.$typeName);
        if (schema)
          return equals2(schema, unpackedA, unpackedB, opts);
      }
      return (0, scalar_js_1.scalarEquals)(descriptors_js_1.ScalarType.BYTES, a.value, b.value);
    }
    function unknownEquals(a, b, registry) {
      function getTrulyUnknown(msg, registry2) {
        var _a;
        let u = (_a = msg.getUnknown()) !== null && _a !== void 0 ? _a : [];
        return registry2 ? u.filter((uf) => !registry2.getExtensionFor(msg.desc, uf.no)) : u;
      }
      let unknownA = getTrulyUnknown(a, registry), unknownB = getTrulyUnknown(b, registry);
      if (unknownA.length != unknownB.length)
        return !1;
      for (let i = 0; i < unknownA.length; i++) {
        let a2 = unknownA[i], b2 = unknownB[i];
        if (a2.no != b2.no || a2.wireType != b2.wireType || !(0, scalar_js_1.scalarEquals)(descriptors_js_1.ScalarType.BYTES, a2.data, b2.data))
          return !1;
      }
      return !0;
    }
    function extensionsEquals(a, b, opts) {
      function getSetExtensions(msg, registry) {
        var _a;
        return ((_a = msg.getUnknown()) !== null && _a !== void 0 ? _a : []).map((uf) => registry.getExtensionFor(msg.desc, uf.no)).filter((e) => e != null).filter((e, index, arr) => arr.indexOf(e) === index);
      }
      let extensionsA = getSetExtensions(a, opts.registry), extensionsB = getSetExtensions(b, opts.registry);
      if (extensionsA.length != extensionsB.length || extensionsA.some((e) => !extensionsB.includes(e)))
        return !1;
      for (let extension of extensionsA) {
        let [containerA, field] = (0, extensions_js_1.createExtensionContainer)(extension, (0, extensions_js_1.getExtension)(a.message, extension)), [containerB] = (0, extensions_js_1.createExtensionContainer)(extension, (0, extensions_js_1.getExtension)(b.message, extension));
        if (!fieldEquals(field, containerA, containerB, opts))
          return !1;
      }
      return !0;
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/fields.js
var require_fields = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/fields.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.isFieldSet = isFieldSet;
    exports.clearField = clearField;
    var unsafe_js_1 = require_unsafe();
    function isFieldSet(message, field) {
      return field.parent.typeName == message.$typeName && (0, unsafe_js_1.unsafeIsSet)(message, field);
    }
    function clearField(message, field) {
      field.parent.typeName == message.$typeName && (0, unsafe_js_1.unsafeClear)(message, field);
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/json.js
var require_json = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wkt/json.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.durationSecondsMax = exports.durationSecondsMin = exports.timestampMsMax = exports.timestampMsMin = void 0;
    exports.timestampMsMin = Date.parse("0001-01-01T00:00:00Z");
    exports.timestampMsMax = Date.parse("9999-12-31T23:59:59Z");
    exports.durationSecondsMin = -315576e6;
    exports.durationSecondsMax = 315576e6;
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wire/size-delimited.js
var require_size_delimited = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wire/size-delimited.js"(exports) {
    "use strict";
    var __asyncValues = exports && exports.__asyncValues || function(o) {
      if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
      var m = o[Symbol.asyncIterator], i;
      return m ? m.call(o) : (o = typeof __values == "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
        return this;
      }, i);
      function verb(n) {
        i[n] = o[n] && function(v) {
          return new Promise(function(resolve, reject) {
            v = o[n](v), settle(resolve, reject, v.done, v.value);
          });
        };
      }
      function settle(resolve, reject, d, v) {
        Promise.resolve(v).then(function(v2) {
          resolve({ value: v2, done: d });
        }, reject);
      }
    }, __await = exports && exports.__await || function(v) {
      return this instanceof __await ? (this.v = v, this) : new __await(v);
    }, __asyncGenerator = exports && exports.__asyncGenerator || function(thisArg, _arguments, generator) {
      if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
      var g = generator.apply(thisArg, _arguments || []), i, q = [];
      return i = Object.create((typeof AsyncIterator == "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
        return this;
      }, i;
      function awaitReturn(f) {
        return function(v) {
          return Promise.resolve(v).then(f, reject);
        };
      }
      function verb(n, f) {
        g[n] && (i[n] = function(v) {
          return new Promise(function(a, b) {
            q.push([n, v, a, b]) > 1 || resume(n, v);
          });
        }, f && (i[n] = f(i[n])));
      }
      function resume(n, v) {
        try {
          step(g[n](v));
        } catch (e) {
          settle(q[0][3], e);
        }
      }
      function step(r) {
        r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
      }
      function fulfill(value) {
        resume("next", value);
      }
      function reject(value) {
        resume("throw", value);
      }
      function settle(f, v) {
        f(v), q.shift(), q.length && resume(q[0][0], q[0][1]);
      }
    };
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.sizeDelimitedEncode = sizeDelimitedEncode;
    exports.sizeDelimitedDecodeStream = sizeDelimitedDecodeStream;
    exports.sizeDelimitedPeek = sizeDelimitedPeek;
    var to_binary_js_1 = require_to_binary(), binary_encoding_js_1 = require_binary_encoding(), from_binary_js_1 = require_from_binary();
    function sizeDelimitedEncode(messageDesc3, message, options) {
      let writer = new binary_encoding_js_1.BinaryWriter();
      return writer.bytes((0, to_binary_js_1.toBinary)(messageDesc3, message, options)), writer.finish();
    }
    var defaultReadMaxBytes = 64 * 1024 * 1024, ByteBuffer = class {
      constructor() {
        this.buffer = new Uint8Array(0), this.length = 0;
      }
      get byteLength() {
        return this.length;
      }
      bytes() {
        return this.buffer.subarray(0, this.length);
      }
      append(chunk) {
        let newByteLength = this.length + chunk.byteLength;
        if (newByteLength > this.buffer.byteLength) {
          let grown = new Uint8Array(Math.max(this.buffer.byteLength * 2, newByteLength));
          grown.set(this.buffer.subarray(0, this.length)), this.buffer = grown;
        }
        this.buffer.set(chunk, this.length), this.length += chunk.byteLength;
      }
    };
    function sizeDelimitedDecodeStream(messageDesc3, iterable, options) {
      return __asyncGenerator(this, arguments, function* () {
        var _a, e_1, _b, _c, _d;
        let readMaxBytes = (_d = options?.readMaxBytes) !== null && _d !== void 0 ? _d : defaultReadMaxBytes, buffer = new ByteBuffer();
        try {
          for (var _e = !0, iterable_1 = __asyncValues(iterable), iterable_1_1; iterable_1_1 = yield __await(iterable_1.next()), _a = iterable_1_1.done, !_a; _e = !0) {
            _c = iterable_1_1.value, _e = !1;
            let chunk = _c;
            buffer.append(chunk);
            let bytes = buffer.bytes(), offset = 0;
            for (; ; ) {
              let size = sizeDelimitedPeek(bytes.subarray(offset));
              if (size.eof)
                break;
              if (size.size > readMaxBytes)
                throw new Error(`message size ${size.size} is larger than configured readMaxBytes ${readMaxBytes}`);
              let messageStart = offset + size.offset, messageEnd = messageStart + size.size;
              if (messageEnd > bytes.byteLength)
                break;
              yield yield __await((0, from_binary_js_1.fromBinary)(messageDesc3, bytes.subarray(messageStart, messageEnd), options)), offset = messageEnd;
            }
            offset > 0 && (buffer = new ByteBuffer(), buffer.append(bytes.subarray(offset)));
          }
        } catch (e_1_1) {
          e_1 = { error: e_1_1 };
        } finally {
          try {
            !_e && !_a && (_b = iterable_1.return) && (yield __await(_b.call(iterable_1)));
          } finally {
            if (e_1) throw e_1.error;
          }
        }
        if (buffer.byteLength > 0)
          throw new Error("incomplete data");
      });
    }
    function sizeDelimitedPeek(data) {
      let sizeEof = { eof: !0, size: null, offset: null };
      for (let i = 0; i < 10; i++) {
        if (i > data.byteLength)
          return sizeEof;
        if ((data[i] & 128) == 0) {
          let reader = new binary_encoding_js_1.BinaryReader(data), size;
          try {
            size = reader.uint32();
          } catch (e) {
            if (e instanceof RangeError)
              return sizeEof;
            throw e;
          }
          return {
            eof: !1,
            size,
            offset: reader.pos
          };
        }
      }
      throw new Error("invalid varint");
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wire/index.js
var require_wire = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/wire/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      k2 === void 0 && (k2 = k);
      var desc = Object.getOwnPropertyDescriptor(m, k);
      (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) && (desc = { enumerable: !0, get: function() {
        return m[k];
      } }), Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      k2 === void 0 && (k2 = k), o[k2] = m[k];
    })), __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p) && __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.configureTextEncoding = exports.getTextEncoding = void 0;
    __exportStar(require_binary_encoding(), exports);
    __exportStar(require_base64_encoding(), exports);
    var text_encoding_js_1 = require_text_encoding();
    Object.defineProperty(exports, "getTextEncoding", { enumerable: !0, get: function() {
      return text_encoding_js_1.getTextEncoding;
    } });
    Object.defineProperty(exports, "configureTextEncoding", { enumerable: !0, get: function() {
      return text_encoding_js_1.configureTextEncoding;
    } });
    __exportStar(require_text_format(), exports);
    __exportStar(require_size_delimited(), exports);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/to-json.js
var require_to_json = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/to-json.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.toJson = toJson;
    exports.toJsonString = toJsonString;
    exports.enumToJson = enumToJson;
    var descriptors_js_1 = require_descriptors(), names_js_1 = require_names(), index_js_1 = require_wkt(), wrappers_js_1 = require_wrappers(), json_js_1 = require_json(), index_js_2 = require_wire(), extensions_js_1 = require_extensions(), reflect_check_js_1 = require_reflect_check(), error_js_1 = require_error(), unsafe_js_1 = require_unsafe(), scalar_js_1 = require_scalar(), message_js_1 = require_message(), LEGACY_REQUIRED = 3, IMPLICIT = 2, jsonWriteDefaults = {
      alwaysEmitImplicit: !1,
      enumAsInteger: !1,
      useProtoFieldName: !1
    };
    function makeWriteOptions(options) {
      return options ? Object.assign(Object.assign({}, jsonWriteDefaults), options) : jsonWriteDefaults;
    }
    function toJson(schema, message, options) {
      return compiledWriter(schema)(makeWriteOptions(options), message);
    }
    function toJsonString(schema, message, options) {
      var _a;
      let jsonValue = toJson(schema, message, options);
      return JSON.stringify(jsonValue, null, (_a = options?.prettySpaces) !== null && _a !== void 0 ? _a : 0);
    }
    function enumToJson(descEnum, value) {
      var _a;
      if (descEnum.typeName == "google.protobuf.NullValue")
        return null;
      let name = (_a = descEnum.value[value]) === null || _a === void 0 ? void 0 : _a.name;
      if (name === void 0)
        throw new Error(`${value} is not a value in ${descEnum}`);
      return name;
    }
    var compiledWriters = /* @__PURE__ */ new WeakMap();
    function compiledWriter(desc) {
      let compiled = compiledWriters.get(desc);
      return compiled === void 0 && (compiled = compileMessage(desc)), compiled;
    }
    function compileMessage(desc) {
      let typeName = desc.typeName, writeWkt = compileWkt(desc);
      if (writeWkt !== void 0) {
        let foreignField2 = desc.fields[0], compiledWriter3 = (opts, message) => {
          if (message.$typeName !== typeName && foreignField2 !== void 0)
            throw new error_js_1.FieldError(foreignField2, `cannot use ${foreignField2} with message ${message.$typeName}`, "ForeignFieldError");
          return writeWkt(opts, message);
        };
        return compiledWriters.set(desc, compiledWriter3), compiledWriter3;
      }
      let sortedFields = desc.fields.concat().sort((a, b) => a.number - b.number), foreignField = sortedFields[0], fieldWriters = [], compiledWriter2 = (opts, message) => {
        if (message.$typeName !== typeName && foreignField !== void 0)
          throw new error_js_1.FieldError(foreignField, `cannot use ${foreignField} with message ${message.$typeName}`, "ForeignFieldError");
        let json = {};
        for (let i = 0; i < fieldWriters.length; i++)
          fieldWriters[i](opts, message, json);
        return opts.registry && writeExtensions(json, opts, opts.registry, message, desc), json;
      };
      compiledWriters.set(desc, compiledWriter2);
      for (let field of sortedFields)
        fieldWriters.push(compileField(field));
      return compiledWriter2;
    }
    function compileWkt(desc) {
      if (desc.typeName.startsWith("google.protobuf."))
        switch (desc.typeName) {
          case "google.protobuf.Any":
            return (opts, message) => anyToJson(message, opts);
          case "google.protobuf.Timestamp":
            return (opts, message) => timestampToJson(message);
          case "google.protobuf.Duration":
            return (opts, message) => durationToJson(message);
          case "google.protobuf.FieldMask":
            return (opts, message) => fieldMaskToJson(message);
          case "google.protobuf.Struct":
            return (opts, message) => structToJson(message);
          case "google.protobuf.Value":
            return (opts, message) => valueToJson(message);
          case "google.protobuf.ListValue":
            return (opts, message) => listValueToJson(message);
          default:
            if ((0, wrappers_js_1.isWrapperDesc)(desc)) {
              let valueField = desc.fields[0], localName = valueField.localName, zero = (0, scalar_js_1.scalarZeroValue)(valueField.scalar, !1), writeScalar = compileScalarValue(valueField);
              return (opts, message) => {
                let value = message[localName];
                return writeScalar(opts, value === void 0 ? zero : value);
              };
            }
            return;
        }
    }
    function compileField(field) {
      switch (field.fieldKind) {
        case "scalar":
        case "enum":
        case "message":
          return compileSingularField(field);
        case "list":
        case "map": {
          let writeValue = field.fieldKind == "list" ? compileListValue(field) : compileMapValue(field), protoName = field.name, jsonKey = field.jsonName, localName = field.localName;
          return (opts, message, json) => {
            let value = writeValue(opts, message[localName]);
            value !== void 0 && (json[opts.useProtoFieldName ? protoName : jsonKey] = value);
          };
        }
      }
    }
    function compileSingularField(field) {
      let writeValue = compileSingularValue(field), protoName = field.name, jsonKey = field.jsonName, localName = field.localName;
      if (field.oneof) {
        let oneofLocalName = field.oneof.localName;
        return (opts, message, json) => {
          let oneof = message[oneofLocalName];
          oneof.case === localName && (json[opts.useProtoFieldName ? protoName : jsonKey] = writeValue(opts, oneof.value));
        };
      }
      if (field.presence != IMPLICIT) {
        let requiredError = field.presence == LEGACY_REQUIRED ? `cannot encode ${field} to JSON: required field not set` : void 0;
        return (opts, message, json) => {
          let value = message[localName];
          if (value !== void 0 && Object.prototype.hasOwnProperty.call(message, localName))
            json[opts.useProtoFieldName ? protoName : jsonKey] = writeValue(opts, value);
          else if (requiredError !== void 0)
            throw new Error(requiredError);
        };
      }
      if (field.fieldKind == "enum") {
        let zero = field.enum.values[0].number;
        return (opts, message, json) => {
          let value = message[localName];
          (value !== zero || opts.alwaysEmitImplicit) && (json[opts.useProtoFieldName ? protoName : jsonKey] = writeValue(opts, value));
        };
      }
      switch (field.scalar) {
        case descriptors_js_1.ScalarType.BOOL:
          return (opts, message, json) => {
            let value = message[localName];
            (value !== !1 || opts.alwaysEmitImplicit) && (json[opts.useProtoFieldName ? protoName : jsonKey] = writeValue(opts, value));
          };
        case descriptors_js_1.ScalarType.STRING:
          return (opts, message, json) => {
            let value = message[localName];
            (value !== "" || opts.alwaysEmitImplicit) && (json[opts.useProtoFieldName ? protoName : jsonKey] = writeValue(opts, value));
          };
        case descriptors_js_1.ScalarType.BYTES:
          return (opts, message, json) => {
            let value = message[localName];
            (!(value instanceof Uint8Array) || value.byteLength > 0 || opts.alwaysEmitImplicit) && (json[opts.useProtoFieldName ? protoName : jsonKey] = writeValue(opts, value));
          };
        case descriptors_js_1.ScalarType.DOUBLE:
        case descriptors_js_1.ScalarType.FLOAT:
          return (opts, message, json) => {
            let value = message[localName];
            (!Object.is(value, 0) || opts.alwaysEmitImplicit) && (json[opts.useProtoFieldName ? protoName : jsonKey] = writeValue(opts, value));
          };
        default:
          return (opts, message, json) => {
            let value = message[localName];
            (value != 0 || opts.alwaysEmitImplicit) && (json[opts.useProtoFieldName ? protoName : jsonKey] = writeValue(opts, value));
          };
      }
    }
    function compileFieldValue(field) {
      switch (field.fieldKind) {
        case "scalar":
        case "enum":
        case "message":
          return compileSingularValue(field);
        case "list":
          return compileListValue(field);
        case "map":
          return compileMapValue(field);
      }
    }
    function compileSingularValue(field) {
      switch (field.fieldKind) {
        case "scalar":
          return compileScalarValue(field);
        case "enum":
          return compileEnumValue(field);
        case "message":
          return compileMessageValue(field);
      }
    }
    function compileMessageValue(field) {
      let { toMessage } = (0, message_js_1.localMessageMapper)(field), writeMessage = compiledWriter(field.message);
      return (opts, value) => writeMessage(opts, toMessage(value));
    }
    function compileListValue(field) {
      let writeItem = compileListItemValue(field);
      return (opts, value) => {
        let items = value;
        if (items.length == 0 && !opts.alwaysEmitImplicit)
          return;
        let jsonArray = [];
        for (let i = 0; i < items.length; i++)
          jsonArray.push(writeItem(opts, items[i]));
        return jsonArray;
      };
    }
    function compileListItemValue(field) {
      switch (field.listKind) {
        case "scalar":
          return compileScalarValue(field);
        case "enum":
          return compileEnumValue(field);
        case "message":
          return compileMessageValue(field);
      }
    }
    function compileMapValue(field) {
      let writeMapValue = compileMapEntryValue(field);
      return (opts, value) => {
        let record = value, keys = Object.keys(record);
        if (keys.length == 0 && !opts.alwaysEmitImplicit)
          return;
        let jsonObject = {};
        for (let i = 0; i < keys.length; i++) {
          let key = keys[i];
          jsonObject[key] = writeMapValue(opts, record[key]);
        }
        return jsonObject;
      };
    }
    function compileMapEntryValue(field) {
      switch (field.mapKind) {
        case "scalar":
          return compileScalarValue(field);
        case "enum":
          return compileEnumValue(field);
        case "message":
          return compileMessageValue(field);
      }
    }
    function compileEnumValue(field) {
      let desc = field.enum;
      return desc.typeName == "google.protobuf.NullValue" ? (opts, value) => {
        if (typeof value != "number")
          throw errorEnumValue(desc, value);
        return null;
      } : (opts, value) => {
        var _a, _b;
        if (typeof value != "number")
          throw errorEnumValue(desc, value);
        return opts.enumAsInteger ? value : (_b = (_a = desc.value[value]) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : value;
      };
    }
    function errorEnumValue(desc, value) {
      return new Error(`cannot encode ${desc} to JSON: expected number, got ${(0, reflect_check_js_1.formatVal)(value)}`);
    }
    function compileScalarValue(field) {
      switch (field.scalar) {
        // int32, fixed32, uint32: JSON value will be a decimal number. Either numbers or strings are accepted.
        case descriptors_js_1.ScalarType.INT32:
        case descriptors_js_1.ScalarType.SFIXED32:
        case descriptors_js_1.ScalarType.SINT32:
        case descriptors_js_1.ScalarType.FIXED32:
        case descriptors_js_1.ScalarType.UINT32:
          return (opts, value) => {
            if (typeof value != "number")
              throw errorScalarValue(field, value);
            return value;
          };
        // float, double: JSON value will be a number or one of the special string values "NaN", "Infinity", and "-Infinity".
        // Either numbers or strings are accepted. Exponent notation is also accepted.
        case descriptors_js_1.ScalarType.FLOAT:
        case descriptors_js_1.ScalarType.DOUBLE:
          return (opts, value) => {
            if (typeof value != "number")
              throw errorScalarValue(field, value);
            return Number.isNaN(value) ? "NaN" : value === Number.POSITIVE_INFINITY ? "Infinity" : value === Number.NEGATIVE_INFINITY ? "-Infinity" : value;
          };
        // string:
        case descriptors_js_1.ScalarType.STRING:
          return (opts, value) => {
            if (typeof value != "string")
              throw errorScalarValue(field, value);
            return value;
          };
        // bool:
        case descriptors_js_1.ScalarType.BOOL:
          return (opts, value) => {
            if (typeof value != "boolean")
              throw errorScalarValue(field, value);
            return value;
          };
        // JSON value will be a decimal string. Either numbers or strings are accepted.
        case descriptors_js_1.ScalarType.UINT64:
        case descriptors_js_1.ScalarType.FIXED64:
        case descriptors_js_1.ScalarType.INT64:
        case descriptors_js_1.ScalarType.SFIXED64:
        case descriptors_js_1.ScalarType.SINT64:
          return (opts, value) => {
            if (typeof value == "bigint" || typeof value == "string" || typeof value == "number" && Number.isInteger(value))
              return value.toString();
            throw errorScalarValue(field, value);
          };
        // bytes: JSON value will be the data encoded as a string using standard base64 encoding with paddings.
        // Either standard or URL-safe base64 encoding with/without paddings are accepted.
        case descriptors_js_1.ScalarType.BYTES:
          return (opts, value) => {
            if (value instanceof Uint8Array)
              return (0, index_js_2.base64Encode)(value);
            throw errorScalarValue(field, value);
          };
      }
    }
    function errorScalarValue(field, value) {
      var _a;
      return new Error(`cannot encode ${field} to JSON: ${(_a = (0, reflect_check_js_1.checkField)(field, value)) === null || _a === void 0 ? void 0 : _a.message}`);
    }
    function writeExtensions(json, opts, registry, message, desc) {
      let unknown = message.$unknown;
      if (unknown === void 0)
        return;
      let tagSeen = /* @__PURE__ */ new Set();
      for (let i = 0; i < unknown.length; i++) {
        let { no } = unknown[i];
        if (!tagSeen.has(no)) {
          tagSeen.add(no);
          let extension = registry.getExtensionFor(desc, no);
          if (!extension)
            continue;
          let value = (0, extensions_js_1.getExtension)(message, extension), [container, field] = (0, extensions_js_1.createExtensionContainer)(extension, value), local = container[unsafe_js_1.unsafeLocal], jsonValue = compileFieldValue(field)(opts, local[field.localName]);
          jsonValue !== void 0 && (json[extension.jsonName] = jsonValue);
        }
      }
    }
    function anyToJson(val, opts) {
      if (val.typeUrl === "")
        return {};
      let { registry } = opts, message, desc;
      if (registry && (message = (0, index_js_1.anyUnpack)(val, registry), message && (desc = registry.getMessage(message.$typeName))), !desc || !message)
        throw new Error(`cannot encode message ${val.$typeName} to JSON: "${val.typeUrl}" is not in the type registry`);
      let json = (0, wrappers_js_1.hasCustomJsonRepresentation)(desc) ? {
        value: compiledWriter(desc)(opts, message)
      } : compiledWriter(desc)(opts, message);
      return json["@type"] = val.typeUrl, json;
    }
    function durationToJson(val) {
      let seconds = Number(val.seconds), nanos = val.nanos;
      if (seconds > json_js_1.durationSecondsMax || seconds < json_js_1.durationSecondsMin)
        throw new Error(`cannot encode message ${val.$typeName} to JSON: value out of range`);
      if (seconds > 0 && nanos < 0 || seconds < 0 && nanos > 0)
        throw new Error(`cannot encode message ${val.$typeName} to JSON: nanos sign must match seconds sign`);
      let text = val.seconds.toString();
      if (nanos !== 0) {
        let nanosStr = Math.abs(nanos).toString();
        nanosStr = "0".repeat(9 - nanosStr.length) + nanosStr, nanosStr.substring(3) === "000000" ? nanosStr = nanosStr.substring(0, 3) : nanosStr.substring(6) === "000" && (nanosStr = nanosStr.substring(0, 6)), text += "." + nanosStr, nanos < 0 && seconds == 0 && (text = "-" + text);
      }
      return text + "s";
    }
    function fieldMaskToJson(val) {
      return val.paths.map((p) => {
        if ((0, names_js_1.protoSnakeCase)((0, names_js_1.protoCamelCase)(p)) !== p)
          throw new Error(`cannot encode message ${val.$typeName} to JSON: lowerCamelCase of path name "${p}" is irreversible`);
        return (0, names_js_1.protoCamelCase)(p);
      }).join(",");
    }
    function structToJson(val) {
      let json = {}, keys = Object.keys(val.fields);
      for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        json[key] = valueToJson(val.fields[key]);
      }
      return json;
    }
    function valueToJson(val) {
      switch (val.kind.case) {
        case "nullValue":
          return null;
        case "numberValue":
          if (!Number.isFinite(val.kind.value))
            throw new Error(`${val.$typeName} cannot be NaN or Infinity`);
          return val.kind.value;
        case "boolValue":
          return val.kind.value;
        case "stringValue":
          return val.kind.value;
        case "structValue":
          return structToJson(val.kind.value);
        case "listValue":
          return listValueToJson(val.kind.value);
        default:
          throw new Error(`${val.$typeName} must have a value`);
      }
    }
    function listValueToJson(val) {
      return val.values.map(valueToJson);
    }
    function timestampToJson(val) {
      let ms = Number(val.seconds) * 1e3;
      if (ms < json_js_1.timestampMsMin || ms > json_js_1.timestampMsMax)
        throw new Error(`cannot encode message ${val.$typeName} to JSON: must be from 0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z inclusive`);
      if (val.nanos < 0)
        throw new Error(`cannot encode message ${val.$typeName} to JSON: nanos must not be negative`);
      if (val.nanos > 999999999)
        throw new Error(`cannot encode message ${val.$typeName} to JSON: nanos must not be greater than 99999999`);
      let z = "Z";
      if (val.nanos > 0) {
        let nanosStr = (val.nanos + 1e9).toString().substring(1);
        nanosStr.substring(3) === "000000" ? z = "." + nanosStr.substring(0, 3) + "Z" : nanosStr.substring(6) === "000" ? z = "." + nanosStr.substring(0, 6) + "Z" : z = "." + nanosStr + "Z";
      }
      return new Date(ms).toISOString().replace(".000Z", z);
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/from-json.js
var require_from_json = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/from-json.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.fromJsonString = fromJsonString;
    exports.mergeFromJsonString = mergeFromJsonString;
    exports.fromJson = fromJson;
    exports.mergeFromJson = mergeFromJson;
    exports.enumFromJson = enumFromJson;
    exports.isEnumJson = isEnumJson;
    var descriptors_js_1 = require_descriptors(), proto_int64_js_1 = require_proto_int64(), create_js_1 = require_create(), error_js_1 = require_error(), reflect_check_js_1 = require_reflect_check(), names_js_1 = require_names(), scalar_js_1 = require_scalar(), unsafe_js_1 = require_unsafe(), message_js_1 = require_message(), base64_encoding_js_1 = require_base64_encoding(), index_js_1 = require_wkt(), extensions_js_1 = require_extensions(), json_js_1 = require_json(), IMPLICIT = 2;
    function makeReadContext(options) {
      return Object.assign(Object.assign({ ignoreUnknownFields: !1, recursionLimit: 100 }, options), { depth: 0 });
    }
    function fromJsonString(schema, json, options) {
      return fromJson(schema, parseJsonString(json, schema.typeName), options);
    }
    function mergeFromJsonString(schema, target, json, options) {
      return mergeFromJson(schema, target, parseJsonString(json, schema.typeName), options);
    }
    function fromJson(schema, json, options) {
      let message = (0, create_js_1.create)(schema);
      return readMessage(schema, message, json, options), message;
    }
    function mergeFromJson(schema, target, json, options) {
      if (target.$typeName !== schema.typeName && schema.fields.length > 0)
        throw new error_js_1.FieldError(schema.fields[0], `cannot use ${schema.fields[0]} with message ${target.$typeName}`, "ForeignFieldError");
      return readMessage(schema, target, json, options), target;
    }
    function readMessage(schema, message, json, options) {
      try {
        compiledReader(schema)(message, json, makeReadContext(options));
      } catch (e) {
        throw (0, error_js_1.isFieldError)(e) ? new Error(`cannot decode ${e.field()} from JSON: ${e.message}`, {
          cause: e
        }) : e;
      }
    }
    function enumFromJson(descEnum, json) {
      return compileEnumConverter(descEnum)(json, !1);
    }
    function isEnumJson(descEnum, value) {
      return descEnum.values.find((v) => v.name === value) !== void 0;
    }
    var compiledReaders = /* @__PURE__ */ new WeakMap();
    function compiledReader(desc) {
      let compiled = compiledReaders.get(desc);
      return compiled === void 0 && (compiled = compileMessage(desc)), compiled;
    }
    function compileMessage(desc) {
      let descString = String(desc), readWkt = compileWkt(desc);
      if (readWkt !== void 0) {
        let compiled2 = (message, json, ctx) => {
          if (++ctx.depth > ctx.recursionLimit)
            throw new Error(`cannot decode ${descString} from JSON: maximum recursion depth of ${ctx.recursionLimit} reached`);
          readWkt(message, json, ctx), ctx.depth--;
        };
        return compiledReaders.set(desc, compiled2), compiled2;
      }
      let typeName = desc.typeName, fieldsByJsonKey = /* @__PURE__ */ new Map(), compiled = (message, json, ctx) => {
        var _a;
        if (++ctx.depth > ctx.recursionLimit)
          throw new Error(`cannot decode ${descString} from JSON: maximum recursion depth of ${ctx.recursionLimit} reached`);
        if (json == null || Array.isArray(json) || typeof json != "object")
          throw new Error(`cannot decode ${descString} from JSON: ${(0, reflect_check_js_1.formatVal)(json)}`);
        let oneofSeen = /* @__PURE__ */ new Map(), fieldSeen = /* @__PURE__ */ new Set(), jsonKeys = Object.keys(json);
        for (let i = 0; i < jsonKeys.length; i++) {
          let jsonKey = jsonKeys[i], jsonValue = json[jsonKey], entry = fieldsByJsonKey.get(jsonKey);
          if (entry !== void 0) {
            let field = entry.field;
            if (fieldSeen.has(field))
              throw new error_js_1.FieldError(field, "set multiple times");
            if (fieldSeen.add(field), entry.oneofScalarNullSkip && jsonValue === null)
              continue;
            if (entry.oneof) {
              let seen = oneofSeen.get(entry.oneof);
              if (seen !== void 0)
                throw new error_js_1.FieldError(entry.oneof, `oneof set multiple times by ${seen.name} and ${field.name}`);
              oneofSeen.set(entry.oneof, field);
            }
            entry.read(message, jsonValue, ctx);
          } else {
            let extension = jsonKey.startsWith("[") && jsonKey.endsWith("]") ? (_a = ctx.registry) === null || _a === void 0 ? void 0 : _a.getExtension(jsonKey.substring(1, jsonKey.length - 1)) : void 0;
            if (extension?.extendee.typeName == typeName) {
              let [container, field, get] = (0, extensions_js_1.createExtensionContainer)(extension);
              compileFieldReader(field)(container[unsafe_js_1.unsafeLocal], jsonValue, ctx), (0, extensions_js_1.setExtension)(message, extension, get());
            }
            if (extension === void 0 && !ctx.ignoreUnknownFields)
              throw new Error(`cannot decode ${descString} from JSON: key "${jsonKey}" is unknown`);
          }
        }
        ctx.depth--;
      };
      compiledReaders.set(desc, compiled);
      for (let field of desc.fields) {
        let entry = {
          read: compileFieldReader(field),
          field,
          oneof: field.oneof,
          oneofScalarNullSkip: field.oneof !== void 0 && field.fieldKind == "scalar"
        };
        fieldsByJsonKey.set(field.name, entry).set(field.jsonName, entry);
      }
      return compiled;
    }
    function compileWkt(desc) {
      if (desc.typeName.startsWith("google.protobuf."))
        switch (desc.typeName) {
          case "google.protobuf.Any":
            return (message, json, ctx) => anyFromJson(message, json, ctx);
          case "google.protobuf.Timestamp":
            return (message, json) => timestampFromJson(message, json);
          case "google.protobuf.Duration":
            return (message, json) => durationFromJson(message, json);
          case "google.protobuf.FieldMask":
            return (message, json) => fieldMaskFromJson(message, json);
          case "google.protobuf.Struct":
            return (message, json, ctx) => structFromJson(message, json, ctx);
          case "google.protobuf.Value":
            return (message, json, ctx) => valueFromJson(message, json, ctx);
          case "google.protobuf.ListValue":
            return (message, json, ctx) => listValueFromJson(message, json, ctx);
          default:
            if ((0, index_js_1.isWrapperDesc)(desc)) {
              let valueField = desc.fields[0], localName = valueField.localName, scalar = valueField.scalar, longAsString = valueField.longAsString, readScalar = compileScalarConverter(valueField);
              return (message, json) => {
                json === null ? message[localName] = (0, scalar_js_1.scalarZeroValue)(scalar, longAsString) : message[localName] = readScalar(json);
              };
            }
            return;
        }
    }
    function compileFieldReader(field) {
      switch (field.fieldKind) {
        case "scalar":
          return compileScalarFieldReader(field);
        case "enum":
          return compileEnumFieldReader(field);
        case "message":
          return compileMessageFieldReader(field);
        case "list":
          return compileListFieldReader(field);
        case "map":
          return compileMapFieldReader(field);
      }
    }
    function compileScalarFieldReader(field) {
      let readScalar = compileScalarConverter(field), localName = field.localName;
      if (field.oneof) {
        let oneofLocalName = field.oneof.localName;
        return (message, json) => {
          message[oneofLocalName] = {
            case: localName,
            value: readScalar(json)
          };
        };
      }
      let clear = compileClear(field);
      return (message, json) => {
        json === null ? clear(message) : message[localName] = readScalar(json);
      };
    }
    function compileClear(field) {
      let localName = field.localName;
      if (field.presence != IMPLICIT)
        return (message) => {
          delete message[localName];
        };
      if (field.fieldKind == "enum") {
        let zero = field.enum.values[0].number;
        return (message) => {
          message[localName] = zero;
        };
      }
      let scalar = field.scalar, longAsString = field.longAsString;
      return (message) => {
        message[localName] = (0, scalar_js_1.scalarZeroValue)(scalar, longAsString);
      };
    }
    function compileEnumFieldReader(field) {
      let readEnumValue = compileEnumConverter(field.enum), checkEnum = compileEnumCheck(field.enum), localName = field.localName, nullResets = field.enum.typeName != "google.protobuf.NullValue";
      if (field.oneof) {
        let oneofLocalName = field.oneof.localName;
        return (message, json, ctx) => {
          if (json === null && nullResets) {
            message[oneofLocalName].case === localName && (message[oneofLocalName] = { case: void 0 });
            return;
          }
          let value = readEnumValue(json, ctx.ignoreUnknownFields);
          if (value === tokenIgnoredUnknownEnum)
            return;
          let check = checkEnum(value);
          if (check !== !0)
            throw new error_js_1.FieldError(field, (0, reflect_check_js_1.reasonSingular)(field, value, check));
          message[oneofLocalName] = { case: localName, value };
        };
      }
      let clear = compileClear(field);
      return (message, json, ctx) => {
        if (json === null && nullResets) {
          clear(message);
          return;
        }
        let value = readEnumValue(json, ctx.ignoreUnknownFields);
        if (value === tokenIgnoredUnknownEnum)
          return;
        let check = checkEnum(value);
        if (check !== !0)
          throw new error_js_1.FieldError(field, (0, reflect_check_js_1.reasonSingular)(field, value, check));
        message[localName] = value;
      };
    }
    function compileMessageFieldReader(field) {
      let localName = field.localName, { toMessage, toLocal } = (0, message_js_1.localMessageMapper)(field), readChild = compiledReader(field.message), nullResets = field.message.typeName != "google.protobuf.Value";
      if (field.oneof) {
        let oneofLocalName = field.oneof.localName;
        return (message, json, ctx) => {
          let oneof = message[oneofLocalName];
          if (json === null && nullResets) {
            oneof.case === localName && (message[oneofLocalName] = { case: void 0 });
            return;
          }
          let child = toMessage(oneof.case === localName ? oneof.value : void 0);
          readChild(child, json, ctx), message[oneofLocalName] = { case: localName, value: toLocal(child) };
        };
      }
      return (message, json, ctx) => {
        if (json === null && nullResets) {
          delete message[localName];
          return;
        }
        let child = toMessage(message[localName]);
        readChild(child, json, ctx), message[localName] = toLocal(child);
      };
    }
    function compileListFieldReader(field) {
      let localName = field.localName, readItem = compileListItemReader(field);
      return (message, json, ctx) => {
        if (json === null)
          return;
        if (!Array.isArray(json))
          throw new error_js_1.FieldError(field, "expected Array, got " + (0, reflect_check_js_1.formatVal)(json));
        let items = message[localName];
        for (let i = 0; i < json.length; i++) {
          let value = readItem(json[i], ctx, items.length);
          value !== tokenIgnoredUnknownEnum && items.push(value);
        }
      };
    }
    function compileListItemReader(field) {
      switch (field.listKind) {
        case "scalar": {
          let parseScalar = compileScalarParse(field), checkValue = (0, reflect_check_js_1.checkScalarValue)(field.scalar), toLocal = compileScalarToLocal(field);
          return (json, ctx, index) => {
            if (json === null)
              throw new error_js_1.FieldError(field, "list item must not be null");
            let value = parseScalar(json), check = checkValue(value);
            if (check !== !0)
              throw new error_js_1.FieldError(field, `list item #${index + 1}: ${(0, reflect_check_js_1.reasonSingular)(field, value, check)}`);
            return toLocal(value);
          };
        }
        case "enum": {
          let readEnumValue = compileEnumConverter(field.enum), checkEnum = compileEnumCheck(field.enum), nullResets = field.enum.typeName != "google.protobuf.NullValue";
          return (json, ctx, index) => {
            if (json === null && nullResets)
              throw new error_js_1.FieldError(field, "list item must not be null");
            let value = readEnumValue(json, ctx.ignoreUnknownFields);
            if (value === tokenIgnoredUnknownEnum)
              return value;
            let check = checkEnum(value);
            if (check !== !0)
              throw new error_js_1.FieldError(field, `list item #${index + 1}: ${(0, reflect_check_js_1.reasonSingular)(field, value, check)}`);
            return value;
          };
        }
        case "message": {
          let { toMessage, toLocal } = (0, message_js_1.localMessageMapper)(field), readChild = compiledReader(field.message), nullResets = field.message.typeName != "google.protobuf.Value";
          return (json, ctx) => {
            if (json === null && nullResets)
              throw new error_js_1.FieldError(field, "list item must not be null");
            let child = toMessage(void 0);
            return readChild(child, json, ctx), toLocal(child);
          };
        }
      }
    }
    function compileMapFieldReader(field) {
      let localName = field.localName, mapKey = field.mapKey, parseMapKey = compileMapKeyParse(mapKey), checkMapKey = (0, reflect_check_js_1.checkScalarValue)(mapKey), parseValue, checkValue, toLocalValue = (value) => value, nullResets = !0;
      switch (field.mapKind) {
        case "scalar": {
          parseValue = compileScalarParse(field), checkValue = (0, reflect_check_js_1.checkScalarValue)(field.scalar), toLocalValue = compileScalarToLocal(field);
          break;
        }
        case "enum": {
          let readEnumValue = compileEnumConverter(field.enum);
          parseValue = (json, ctx) => readEnumValue(json, ctx.ignoreUnknownFields), checkValue = compileEnumCheck(field.enum), nullResets = field.enum.typeName != "google.protobuf.NullValue";
          break;
        }
        case "message": {
          let { toMessage, toLocal } = (0, message_js_1.localMessageMapper)(field), readChild = compiledReader(field.message);
          nullResets = field.message.typeName != "google.protobuf.Value", parseValue = (json, ctx) => {
            let child = toMessage(void 0);
            return readChild(child, json, ctx), toLocal(child);
          };
          break;
        }
      }
      return (message, json, ctx) => {
        if (json === null)
          return;
        if (typeof json != "object" || Array.isArray(json))
          throw new error_js_1.FieldError(field, "expected object, got " + (0, reflect_check_js_1.formatVal)(json));
        let record = message[localName], seen = /* @__PURE__ */ new Set(), jsonMapKeys = Object.keys(json);
        for (let i = 0; i < jsonMapKeys.length; i++) {
          let jsonMapKey = jsonMapKeys[i], jsonMapValue = json[jsonMapKey], key = parseMapKey(jsonMapKey);
          if (seen.has(key))
            throw new error_js_1.FieldError(field, `duplicate map key "${jsonMapKey}"`);
          if (seen.add(key), jsonMapValue === null && nullResets)
            throw new error_js_1.FieldError(field, "map value must not be null");
          let value = parseValue(jsonMapValue, ctx);
          if (value === tokenIgnoredUnknownEnum)
            continue;
          let checkKey = checkMapKey(key);
          if (checkKey !== !0)
            throw new error_js_1.FieldError(field, `invalid map key: ${(0, reflect_check_js_1.reasonSingular)({ scalar: mapKey }, key, checkKey)}`);
          if (checkValue !== void 0) {
            let check = checkValue(value);
            if (check !== !0)
              throw new error_js_1.FieldError(field, `map entry ${(0, reflect_check_js_1.formatVal)(key)}: ${(0, reflect_check_js_1.reasonSingular)(field, value, check)}`);
          }
          record[key] = toLocalValue(value);
        }
      };
    }
    var tokenIgnoredUnknownEnum = /* @__PURE__ */ Symbol();
    function compileEnumConverter(desc) {
      let zero = desc.values[0].number, values = desc.values;
      return (json, ignoreUnknownFields) => {
        if (json === null)
          return zero;
        switch (typeof json) {
          case "number":
            if (Number.isInteger(json))
              return json;
            break;
          case "string": {
            let value = values.find((ev) => ev.name === json);
            if (value !== void 0)
              return value.number;
            if (ignoreUnknownFields)
              return tokenIgnoredUnknownEnum;
            break;
          }
        }
        throw new Error(`cannot decode ${desc} from JSON: ${(0, reflect_check_js_1.formatVal)(json)}`);
      };
    }
    function compileEnumCheck(desc) {
      if (desc.open)
        return (0, reflect_check_js_1.checkScalarValue)(descriptors_js_1.ScalarType.INT32);
      let values = desc.values;
      return (value) => values.some((v) => v.number === value);
    }
    function compileScalarConverter(field) {
      let parseScalar = compileScalarParse(field), checkValue = (0, reflect_check_js_1.checkScalarValue)(field.scalar), toLocal = compileScalarToLocal(field);
      return (json) => {
        let value = parseScalar(json), check = checkValue(value);
        if (check !== !0)
          throw new error_js_1.FieldError(field, (0, reflect_check_js_1.reasonSingular)(field, value, check));
        return toLocal(value);
      };
    }
    function compileScalarParse(field) {
      switch (field.scalar) {
        // float, double: JSON value will be a number or one of the special string values "NaN", "Infinity", and "-Infinity".
        // Either numbers or strings are accepted. Exponent notation is also accepted.
        case descriptors_js_1.ScalarType.DOUBLE:
        case descriptors_js_1.ScalarType.FLOAT:
          return (json) => {
            if (json === "NaN")
              return NaN;
            if (json === "Infinity")
              return Number.POSITIVE_INFINITY;
            if (json === "-Infinity")
              return Number.NEGATIVE_INFINITY;
            if (typeof json == "number") {
              if (Number.isNaN(json))
                throw new error_js_1.FieldError(field, "unexpected NaN number");
              if (!Number.isFinite(json))
                throw new error_js_1.FieldError(field, "unexpected infinite number");
              return json;
            }
            if (typeof json == "string") {
              if (json === "" || json.trim().length !== json.length)
                return json;
              let float = Number(json);
              return Number.isFinite(float) ? float : json;
            }
            return json;
          };
        // int32, fixed32, uint32: JSON value will be a decimal number. Either numbers or strings are accepted.
        case descriptors_js_1.ScalarType.INT32:
        case descriptors_js_1.ScalarType.FIXED32:
        case descriptors_js_1.ScalarType.SFIXED32:
        case descriptors_js_1.ScalarType.SINT32:
        case descriptors_js_1.ScalarType.UINT32:
          return int32FromJson;
        // bytes: JSON value will be the data encoded as a string using standard base64 encoding with paddings.
        // Either standard or URL-safe base64 encoding with/without paddings are accepted.
        case descriptors_js_1.ScalarType.BYTES:
          return (json) => {
            if (typeof json == "string") {
              if (json === "")
                return new Uint8Array(0);
              try {
                return (0, base64_encoding_js_1.base64Decode)(json);
              } catch (e) {
                let message = e instanceof Error ? e.message : String(e);
                throw new error_js_1.FieldError(field, message);
              }
            }
            return json;
          };
        // int64, sfixed64, sint64, fixed64, uint64: The validation step accepts
        // string and number. string, bool: no conversion.
        default:
          return (json) => json;
      }
    }
    function compileScalarToLocal(field) {
      let longAsString = field.fieldKind !== "map" && field.longAsString;
      switch (field.scalar) {
        case descriptors_js_1.ScalarType.INT64:
        case descriptors_js_1.ScalarType.SFIXED64:
        case descriptors_js_1.ScalarType.SINT64:
          return longAsString ? (value) => String(value) : (value) => typeof value == "string" || typeof value == "number" ? proto_int64_js_1.protoInt64.parse(value) : value;
        case descriptors_js_1.ScalarType.FIXED64:
        case descriptors_js_1.ScalarType.UINT64:
          return longAsString ? (value) => String(value) : (value) => typeof value == "string" || typeof value == "number" ? proto_int64_js_1.protoInt64.uParse(value) : value;
        default:
          return (value) => value;
      }
    }
    function compileMapKeyParse(type) {
      switch (type) {
        case descriptors_js_1.ScalarType.BOOL:
          return (jsonString) => {
            switch (jsonString) {
              case "true":
                return !0;
              case "false":
                return !1;
            }
            return jsonString;
          };
        case descriptors_js_1.ScalarType.INT32:
        case descriptors_js_1.ScalarType.FIXED32:
        case descriptors_js_1.ScalarType.UINT32:
        case descriptors_js_1.ScalarType.SFIXED32:
        case descriptors_js_1.ScalarType.SINT32:
          return int32FromJson;
        case descriptors_js_1.ScalarType.INT64:
        case descriptors_js_1.ScalarType.SINT64:
        case descriptors_js_1.ScalarType.SFIXED64:
        case descriptors_js_1.ScalarType.UINT64:
        case descriptors_js_1.ScalarType.FIXED64:
          return (jsonString) => /^-?0+$/.test(jsonString) ? "0" : jsonString.replace(/^(-?)0+(?=\d)/, "$1");
        default:
          return (jsonString) => jsonString;
      }
    }
    function int32FromJson(json) {
      if (typeof json == "string") {
        if (json === "" || json.trim().length !== json.length)
          return json;
        let num = Number(json);
        return Number.isNaN(num) ? json : num;
      }
      return json;
    }
    function parseJsonString(jsonString, typeName) {
      let json;
      try {
        json = JSON.parse(jsonString);
      } catch (e) {
        let message = e instanceof Error ? e.message : String(e);
        throw new Error(
          `cannot decode message ${typeName} from JSON: ${message}`,
          // @ts-expect-error we use the ES2022 error CTOR option "cause" for better stack traces
          { cause: e }
        );
      }
      return checkDuplicateKeys(jsonString, typeName), json;
    }
    function checkDuplicateKeys(jsonString, typeName) {
      let stack = [], expectKey = !1, i = 0;
      for (; i < jsonString.length; )
        switch (jsonString[i]) {
          case "{":
            stack.push(/* @__PURE__ */ new Set()), expectKey = !0, i++;
            break;
          case "[":
            stack.push(null), expectKey = !1, i++;
            break;
          case "}":
          case "]":
            stack.pop(), expectKey = !1, i++;
            break;
          case ",":
            expectKey = stack[stack.length - 1] != null, i++;
            break;
          case ":":
            expectKey = !1, i++;
            break;
          case '"': {
            let open = i++, escaped = !1;
            for (; i < jsonString.length; ) {
              if (jsonString[i] == "\\") {
                escaped = !0, i += 2;
                continue;
              }
              if (jsonString[i] == '"')
                break;
              i++;
            }
            let close = i++, seen = stack[stack.length - 1];
            if (expectKey && seen) {
              let name = escaped ? JSON.parse(jsonString.substring(open, close + 1)) : jsonString.substring(open + 1, close);
              if (seen.has(name))
                throw new Error(`cannot decode message ${typeName} from JSON: duplicate object key "${name}"`);
              seen.add(name);
            }
            expectKey = !1;
            break;
          }
          default:
            i++;
            break;
        }
    }
    function anyFromJson(any, json, ctx) {
      var _a;
      if (json === null || Array.isArray(json) || typeof json != "object")
        throw new Error(`cannot decode message ${any.$typeName} from JSON: expected object but got ${(0, reflect_check_js_1.formatVal)(json)}`);
      if (Object.keys(json).length == 0)
        return;
      let typeUrl = json["@type"];
      if (typeof typeUrl != "string" || typeUrl == "")
        throw new Error(`cannot decode message ${any.$typeName} from JSON: "@type" is empty`);
      let typeName = typeUrl.includes("/") ? typeUrl.substring(typeUrl.lastIndexOf("/") + 1) : typeUrl;
      if (!typeName.length)
        throw new Error(`cannot decode message ${any.$typeName} from JSON: "@type" is invalid`);
      let desc = (_a = ctx.registry) === null || _a === void 0 ? void 0 : _a.getMessage(typeName);
      if (!desc)
        throw new Error(`cannot decode message ${any.$typeName} from JSON: ${typeUrl} is not in the type registry`);
      let message = (0, create_js_1.create)(desc);
      if ((0, index_js_1.hasCustomJsonRepresentation)(desc) && Object.prototype.hasOwnProperty.call(json, "value"))
        compiledReader(desc)(message, json.value, ctx);
      else {
        let copy = Object.assign({}, json);
        delete copy["@type"], compiledReader(desc)(message, copy, ctx);
      }
      (0, index_js_1.anyPack)(desc, message, any);
    }
    function timestampFromJson(timestamp, json) {
      if (typeof json != "string")
        throw new Error(`cannot decode message ${timestamp.$typeName} from JSON: ${(0, reflect_check_js_1.formatVal)(json)}`);
      let matches = json.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]{1,9}))?(?:Z|([+-][0-9][0-9]:[0-9][0-9]))$/);
      if (!matches)
        throw new Error(`cannot decode message ${timestamp.$typeName} from JSON: invalid RFC 3339 string`);
      let ms = Date.parse(
        // biome-ignore format: want this to read well
        matches[1] + "-" + matches[2] + "-" + matches[3] + "T" + matches[4] + ":" + matches[5] + ":" + matches[6] + (matches[8] ? matches[8] : "Z")
      );
      if (Number.isNaN(ms))
        throw new Error(`cannot decode message ${timestamp.$typeName} from JSON: invalid RFC 3339 string`);
      if (ms < json_js_1.timestampMsMin || ms > json_js_1.timestampMsMax)
        throw new Error(`cannot decode message ${timestamp.$typeName} from JSON: must be from 0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z inclusive`);
      timestamp.seconds = proto_int64_js_1.protoInt64.parse(ms / 1e3), timestamp.nanos = 0, matches[7] && (timestamp.nanos = parseInt("1" + matches[7] + "0".repeat(9 - matches[7].length)) - 1e9);
    }
    function durationFromJson(duration, json) {
      if (typeof json != "string")
        throw new Error(`cannot decode message ${duration.$typeName} from JSON: ${(0, reflect_check_js_1.formatVal)(json)}`);
      let match = json.match(/^(-?[0-9]+)(?:\.([0-9]+))?s/);
      if (match === null)
        throw new Error(`cannot decode message ${duration.$typeName} from JSON: ${(0, reflect_check_js_1.formatVal)(json)}`);
      let longSeconds = Number(match[1]);
      if (longSeconds > json_js_1.durationSecondsMax || longSeconds < json_js_1.durationSecondsMin)
        throw new Error(`cannot decode message ${duration.$typeName} from JSON: ${(0, reflect_check_js_1.formatVal)(json)}`);
      if (duration.seconds = proto_int64_js_1.protoInt64.parse(longSeconds), typeof match[2] != "string")
        return;
      let nanosStr = match[2] + "0".repeat(9 - match[2].length);
      duration.nanos = parseInt(nanosStr), (longSeconds < 0 || Object.is(longSeconds, -0)) && (duration.nanos = -duration.nanos);
    }
    function fieldMaskFromJson(fieldMask, json) {
      if (typeof json != "string")
        throw new Error(`cannot decode message ${fieldMask.$typeName} from JSON: ${(0, reflect_check_js_1.formatVal)(json)}`);
      json !== "" && (fieldMask.paths = json.split(",").map((path) => {
        if (path.includes("_"))
          throw new Error(`cannot decode message ${fieldMask.$typeName} from JSON: path names must be lowerCamelCase`);
        return (0, names_js_1.protoSnakeCase)(path);
      }));
    }
    function structFromJson(struct, json, ctx) {
      if (typeof json != "object" || json == null || Array.isArray(json))
        throw new Error(`cannot decode message ${struct.$typeName} from JSON ${(0, reflect_check_js_1.formatVal)(json)}`);
      let keys = Object.keys(json);
      for (let i = 0; i < keys.length; i++) {
        let key = keys[i], parsedValue = (0, create_js_1.create)(index_js_1.ValueSchema);
        valueFromJson(parsedValue, json[key], ctx), struct.fields[key] = parsedValue;
      }
    }
    function valueFromJson(value, json, ctx) {
      if (++ctx.depth > ctx.recursionLimit)
        throw new Error(`cannot decode ${value.$typeName} from JSON: maximum recursion depth of ${ctx.recursionLimit} reached`);
      switch (typeof json) {
        case "number":
          value.kind = { case: "numberValue", value: json };
          break;
        case "string":
          value.kind = { case: "stringValue", value: json };
          break;
        case "boolean":
          value.kind = { case: "boolValue", value: json };
          break;
        case "object":
          if (json === null)
            value.kind = { case: "nullValue", value: index_js_1.NullValue.NULL_VALUE };
          else if (Array.isArray(json)) {
            let listValue = (0, create_js_1.create)(index_js_1.ListValueSchema);
            listValueFromJson(listValue, json, ctx), value.kind = { case: "listValue", value: listValue };
          } else {
            let struct = (0, create_js_1.create)(index_js_1.StructSchema);
            structFromJson(struct, json, ctx), value.kind = { case: "structValue", value: struct };
          }
          break;
        default:
          throw new Error(`cannot decode message ${value.$typeName} from JSON ${(0, reflect_check_js_1.formatVal)(json)}`);
      }
      return ctx.depth--, value;
    }
    function listValueFromJson(listValue, json, ctx) {
      if (!Array.isArray(json))
        throw new Error(`cannot decode message ${listValue.$typeName} from JSON ${(0, reflect_check_js_1.formatVal)(json)}`);
      for (let i = 0; i < json.length; i++) {
        let value = (0, create_js_1.create)(index_js_1.ValueSchema);
        valueFromJson(value, json[i], ctx), listValue.values.push(value);
      }
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/merge.js
var require_merge = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/merge.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.merge = merge;
    var reflect_js_1 = require_reflect();
    function merge(schema, target, source) {
      reflectMerge((0, reflect_js_1.reflect)(schema, target), (0, reflect_js_1.reflect)(schema, source));
    }
    function reflectMerge(target, source) {
      var _a, _b;
      let sourceUnknown = source.message.$unknown;
      sourceUnknown !== void 0 && sourceUnknown.length > 0 && ((_a = (_b = target.message).$unknown) !== null && _a !== void 0 || (_b.$unknown = []), target.message.$unknown.push(...sourceUnknown));
      for (let f of target.fields)
        if (source.isSet(f))
          switch (f.fieldKind) {
            case "scalar":
            case "enum":
              target.set(f, source.get(f));
              break;
            case "message":
              target.isSet(f) ? reflectMerge(target.get(f), source.get(f)) : target.set(f, source.get(f));
              break;
            case "list":
              let list = target.get(f);
              for (let e of source.get(f))
                list.add(e);
              break;
            case "map":
              let map = target.get(f);
              for (let [k, v] of source.get(f))
                map.set(k, v);
              break;
          }
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/unknown-enum.js
var require_unknown_enum = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/unknown-enum.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.isUnknownEnum = isUnknownEnum;
    function isUnknownEnum(desc, value) {
      return desc.value[value] === void 0;
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/index.js
var require_commonjs = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      k2 === void 0 && (k2 = k);
      var desc = Object.getOwnPropertyDescriptor(m, k);
      (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) && (desc = { enumerable: !0, get: function() {
        return m[k];
      } }), Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      k2 === void 0 && (k2 = k), o[k2] = m[k];
    })), __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p) && __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.getOption = exports.hasOption = exports.clearExtension = exports.setExtension = exports.getExtension = exports.hasExtension = exports.mergeFromBinary = exports.fromBinary = exports.toBinary = void 0;
    __exportStar(require_types(), exports);
    __exportStar(require_is_message(), exports);
    __exportStar(require_create(), exports);
    __exportStar(require_clone(), exports);
    __exportStar(require_descriptors(), exports);
    __exportStar(require_equals(), exports);
    __exportStar(require_fields(), exports);
    __exportStar(require_registry(), exports);
    var to_binary_js_1 = require_to_binary();
    Object.defineProperty(exports, "toBinary", { enumerable: !0, get: function() {
      return to_binary_js_1.toBinary;
    } });
    var from_binary_js_1 = require_from_binary();
    Object.defineProperty(exports, "fromBinary", { enumerable: !0, get: function() {
      return from_binary_js_1.fromBinary;
    } });
    Object.defineProperty(exports, "mergeFromBinary", { enumerable: !0, get: function() {
      return from_binary_js_1.mergeFromBinary;
    } });
    __exportStar(require_to_json(), exports);
    __exportStar(require_from_json(), exports);
    __exportStar(require_merge(), exports);
    var extensions_js_1 = require_extensions();
    Object.defineProperty(exports, "hasExtension", { enumerable: !0, get: function() {
      return extensions_js_1.hasExtension;
    } });
    Object.defineProperty(exports, "getExtension", { enumerable: !0, get: function() {
      return extensions_js_1.getExtension;
    } });
    Object.defineProperty(exports, "setExtension", { enumerable: !0, get: function() {
      return extensions_js_1.setExtension;
    } });
    Object.defineProperty(exports, "clearExtension", { enumerable: !0, get: function() {
      return extensions_js_1.clearExtension;
    } });
    Object.defineProperty(exports, "hasOption", { enumerable: !0, get: function() {
      return extensions_js_1.hasOption;
    } });
    Object.defineProperty(exports, "getOption", { enumerable: !0, get: function() {
      return extensions_js_1.getOption;
    } });
    __exportStar(require_proto_int64(), exports);
    __exportStar(require_unknown_enum(), exports);
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/embed.js
var require_embed = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/embed.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.embedFileDesc = embedFileDesc;
    exports.pathInFileDesc = pathInFileDesc;
    exports.createFileDescriptorProtoBoot = createFileDescriptorProtoBoot;
    var names_js_1 = require_names(), fields_js_1 = require_fields(), base64_encoding_js_1 = require_base64_encoding(), to_binary_js_1 = require_to_binary(), clone_js_1 = require_clone(), descriptor_pb_js_1 = require_descriptor_pb();
    function embedFileDesc(file) {
      let embed = {
        bootable: !1,
        proto() {
          let stripped = (0, clone_js_1.clone)(descriptor_pb_js_1.FileDescriptorProtoSchema, file);
          return (0, fields_js_1.clearField)(stripped, descriptor_pb_js_1.FileDescriptorProtoSchema.field.dependency), (0, fields_js_1.clearField)(stripped, descriptor_pb_js_1.FileDescriptorProtoSchema.field.sourceCodeInfo), stripped.messageType.map(stripJsonNames), stripped;
        },
        base64() {
          let bytes = (0, to_binary_js_1.toBinary)(descriptor_pb_js_1.FileDescriptorProtoSchema, this.proto());
          return (0, base64_encoding_js_1.base64Encode)(bytes, "std_raw");
        }
      };
      return file.name == "google/protobuf/descriptor.proto" ? Object.assign(Object.assign({}, embed), { bootable: !0, boot() {
        return createFileDescriptorProtoBoot(this.proto());
      } }) : embed;
    }
    function stripJsonNames(d) {
      for (let f of d.field)
        f.jsonName === (0, names_js_1.protoCamelCase)(f.name) && (0, fields_js_1.clearField)(f, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.jsonName);
      for (let n of d.nestedType)
        stripJsonNames(n);
    }
    function pathInFileDesc(desc) {
      if (desc.kind == "service")
        return [desc.file.services.indexOf(desc)];
      let parent = desc.parent;
      if (parent == null)
        switch (desc.kind) {
          case "enum":
            return [desc.file.enums.indexOf(desc)];
          case "message":
            return [desc.file.messages.indexOf(desc)];
          case "extension":
            return [desc.file.extensions.indexOf(desc)];
        }
      function findPath(cur) {
        let nested = [];
        for (let parent2 = cur.parent; parent2; ) {
          let idx = parent2.nestedMessages.indexOf(cur);
          nested.unshift(idx), cur = parent2, parent2 = cur.parent;
        }
        return nested.unshift(cur.file.messages.indexOf(cur)), nested;
      }
      let path = findPath(parent);
      switch (desc.kind) {
        case "extension":
          return [...path, parent.nestedExtensions.indexOf(desc)];
        case "message":
          return [...path, parent.nestedMessages.indexOf(desc)];
        case "enum":
          return [...path, parent.nestedEnums.indexOf(desc)];
      }
    }
    function createFileDescriptorProtoBoot(proto) {
      var _a;
      return assert2(proto.name == "google/protobuf/descriptor.proto"), assert2(proto.package == "google.protobuf"), assert2(!proto.dependency.length), assert2(!proto.publicDependency.length), assert2(!proto.weakDependency.length), assert2(!proto.optionDependency.length), assert2(!proto.service.length), assert2(!proto.extension.length), assert2(proto.sourceCodeInfo === void 0), assert2(proto.syntax == "" || proto.syntax == "proto2"), assert2(!(!((_a = proto.options) === null || _a === void 0) && _a.features)), assert2(proto.edition === descriptor_pb_js_1.Edition.EDITION_UNKNOWN), {
        name: proto.name,
        package: proto.package,
        messageType: proto.messageType.map(createDescriptorBoot),
        enumType: proto.enumType.map(createEnumDescriptorBoot)
      };
    }
    function createDescriptorBoot(proto) {
      assert2(proto.extension.length == 0), assert2(!proto.oneofDecl.length), assert2(!proto.options), assert2(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.DescriptorProtoSchema.field.visibility));
      let b = {
        name: proto.name
      };
      return proto.field.length && (b.field = proto.field.map(createFieldDescriptorBoot)), proto.nestedType.length && (b.nestedType = proto.nestedType.map(createDescriptorBoot)), proto.enumType.length && (b.enumType = proto.enumType.map(createEnumDescriptorBoot)), proto.extensionRange.length && (b.extensionRange = proto.extensionRange.map((r) => (assert2(!r.options), { start: r.start, end: r.end }))), b;
    }
    function createFieldDescriptorBoot(proto) {
      assert2((0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.name)), assert2((0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.number)), assert2((0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.type)), assert2(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.oneofIndex)), assert2(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.jsonName) || proto.jsonName === (0, names_js_1.protoCamelCase)(proto.name));
      let b = {
        name: proto.name,
        number: proto.number,
        type: proto.type
      };
      return (0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.label) && (b.label = proto.label), (0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.typeName) && (b.typeName = proto.typeName), (0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.extendee) && (b.extendee = proto.extendee), (0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.defaultValue) && (b.defaultValue = proto.defaultValue), proto.options && (b.options = createFieldOptionsBoot(proto.options)), b;
    }
    function createFieldOptionsBoot(proto) {
      let b = {};
      return assert2(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.ctype)), (0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.packed) && (b.packed = proto.packed), assert2(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.jstype)), assert2(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.lazy)), assert2(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.unverifiedLazy)), (0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.deprecated) && (b.deprecated = proto.deprecated), assert2(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.weak)), assert2(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.debugRedact)), (0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.retention) && (b.retention = proto.retention), proto.targets.length && (b.targets = proto.targets), proto.editionDefaults.length && (b.editionDefaults = proto.editionDefaults.map((d) => ({
        value: d.value,
        edition: d.edition
      }))), assert2(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.features)), assert2(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.uninterpretedOption)), b;
    }
    function createEnumDescriptorBoot(proto) {
      return assert2(!proto.options), assert2(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.EnumDescriptorProtoSchema.field.visibility)), {
        name: proto.name,
        value: proto.value.map((v) => (assert2(!v.options), {
          name: v.name,
          number: v.number
        }))
      };
    }
    function assert2(condition) {
      if (!condition)
        throw new Error();
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/service.js
var require_service = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/service.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.serviceDesc = serviceDesc;
    function serviceDesc(file, path, ...paths) {
      if (paths.length > 0)
        throw new Error();
      return file.services[path];
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/symbols.js
var require_symbols = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/symbols.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.symbols = exports.wktPublicImportPaths = exports.packageName = void 0;
    exports.packageName = "@bufbuild/protobuf";
    exports.wktPublicImportPaths = {
      "google/protobuf/compiler/plugin.proto": exports.packageName + "/wkt",
      "google/protobuf/any.proto": exports.packageName + "/wkt",
      "google/protobuf/api.proto": exports.packageName + "/wkt",
      "google/protobuf/cpp_features.proto": exports.packageName + "/wkt",
      "google/protobuf/descriptor.proto": exports.packageName + "/wkt",
      "google/protobuf/duration.proto": exports.packageName + "/wkt",
      "google/protobuf/empty.proto": exports.packageName + "/wkt",
      "google/protobuf/field_mask.proto": exports.packageName + "/wkt",
      "google/protobuf/go_features.proto": exports.packageName + "/wkt",
      "google/protobuf/java_features.proto": exports.packageName + "/wkt",
      "google/protobuf/source_context.proto": exports.packageName + "/wkt",
      "google/protobuf/struct.proto": exports.packageName + "/wkt",
      "google/protobuf/timestamp.proto": exports.packageName + "/wkt",
      "google/protobuf/type.proto": exports.packageName + "/wkt",
      "google/protobuf/wrappers.proto": exports.packageName + "/wkt"
    };
    exports.symbols = {
      isMessage: { typeOnly: !1, bootstrapWktFrom: "../../is-message.js", from: exports.packageName },
      Message: { typeOnly: !0, bootstrapWktFrom: "../../types.js", from: exports.packageName },
      create: { typeOnly: !1, bootstrapWktFrom: "../../create.js", from: exports.packageName },
      fromJson: { typeOnly: !1, bootstrapWktFrom: "../../from-json.js", from: exports.packageName },
      fromJsonString: { typeOnly: !1, bootstrapWktFrom: "../../from-json.js", from: exports.packageName },
      fromBinary: { typeOnly: !1, bootstrapWktFrom: "../../from-binary.js", from: exports.packageName },
      toBinary: { typeOnly: !1, bootstrapWktFrom: "../../to-binary.js", from: exports.packageName },
      toJson: { typeOnly: !1, bootstrapWktFrom: "../../to-json.js", from: exports.packageName },
      toJsonString: { typeOnly: !1, bootstrapWktFrom: "../../to-json.js", from: exports.packageName },
      protoInt64: { typeOnly: !1, bootstrapWktFrom: "../../proto-int64.js", from: exports.packageName },
      JsonValue: { typeOnly: !0, bootstrapWktFrom: "../../json-value.js", from: exports.packageName },
      JsonObject: { typeOnly: !0, bootstrapWktFrom: "../../json-value.js", from: exports.packageName },
      UnknownEnum: { typeOnly: !0, bootstrapWktFrom: "../../types.js", from: exports.packageName },
      codegen: {
        boot: { typeOnly: !1, bootstrapWktFrom: "../../codegenv2/boot.js", from: exports.packageName + "/codegenv2" },
        fileDesc: { typeOnly: !1, bootstrapWktFrom: "../../codegenv2/file.js", from: exports.packageName + "/codegenv2" },
        enumDesc: { typeOnly: !1, bootstrapWktFrom: "../../codegenv2/enum.js", from: exports.packageName + "/codegenv2" },
        extDesc: { typeOnly: !1, bootstrapWktFrom: "../../codegenv2/extension.js", from: exports.packageName + "/codegenv2" },
        messageDesc: { typeOnly: !1, bootstrapWktFrom: "../../codegenv2/message.js", from: exports.packageName + "/codegenv2" },
        serviceDesc: { typeOnly: !1, bootstrapWktFrom: "../../codegenv2/service.js", from: exports.packageName + "/codegenv2" },
        tsEnum: { typeOnly: !1, bootstrapWktFrom: "../../codegenv2/enum.js", from: exports.packageName + "/codegenv2" },
        objEnum: { typeOnly: !1, bootstrapWktFrom: "../../codegenv2/enum.js", from: exports.packageName + "/codegenv2" },
        GenFile: { typeOnly: !0, bootstrapWktFrom: "../../codegenv2/types.js", from: exports.packageName + "/codegenv2" },
        GenEnum: { typeOnly: !0, bootstrapWktFrom: "../../codegenv2/types.js", from: exports.packageName + "/codegenv2" },
        GenExtension: { typeOnly: !0, bootstrapWktFrom: "../../codegenv2/types.js", from: exports.packageName + "/codegenv2" },
        GenMessage: { typeOnly: !0, bootstrapWktFrom: "../../codegenv2/types.js", from: exports.packageName + "/codegenv2" },
        GenService: { typeOnly: !0, bootstrapWktFrom: "../../codegenv2/types.js", from: exports.packageName + "/codegenv2" }
      }
    };
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/scalar.js
var require_scalar2 = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/scalar.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.scalarTypeScriptType = scalarTypeScriptType;
    exports.scalarJsonType = scalarJsonType;
    var descriptors_js_1 = require_descriptors();
    function scalarTypeScriptType(scalar, longAsString) {
      switch (scalar) {
        case descriptors_js_1.ScalarType.STRING:
          return "string";
        case descriptors_js_1.ScalarType.BOOL:
          return "boolean";
        case descriptors_js_1.ScalarType.UINT64:
        case descriptors_js_1.ScalarType.SFIXED64:
        case descriptors_js_1.ScalarType.FIXED64:
        case descriptors_js_1.ScalarType.SINT64:
        case descriptors_js_1.ScalarType.INT64:
          return longAsString ? "string" : "bigint";
        case descriptors_js_1.ScalarType.BYTES:
          return "Uint8Array";
        default:
          return "number";
      }
    }
    function scalarJsonType(scalar) {
      switch (scalar) {
        case descriptors_js_1.ScalarType.DOUBLE:
        case descriptors_js_1.ScalarType.FLOAT:
          return 'number | "NaN" | "Infinity" | "-Infinity"';
        case descriptors_js_1.ScalarType.UINT64:
        case descriptors_js_1.ScalarType.SFIXED64:
        case descriptors_js_1.ScalarType.FIXED64:
        case descriptors_js_1.ScalarType.SINT64:
        case descriptors_js_1.ScalarType.INT64:
          return "string";
        case descriptors_js_1.ScalarType.INT32:
        case descriptors_js_1.ScalarType.FIXED32:
        case descriptors_js_1.ScalarType.UINT32:
        case descriptors_js_1.ScalarType.SFIXED32:
        case descriptors_js_1.ScalarType.SINT32:
          return "number";
        case descriptors_js_1.ScalarType.STRING:
          return "string";
        case descriptors_js_1.ScalarType.BOOL:
          return "boolean";
        case descriptors_js_1.ScalarType.BYTES:
          return "string";
      }
    }
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/types.js
var require_types2 = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
  }
});

// javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/index.js
var require_codegenv2 = __commonJS({
  "javascript/node_modules/@bufbuild/protobuf/dist/commonjs/codegenv2/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      k2 === void 0 && (k2 = k);
      var desc = Object.getOwnPropertyDescriptor(m, k);
      (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) && (desc = { enumerable: !0, get: function() {
        return m[k];
      } }), Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      k2 === void 0 && (k2 = k), o[k2] = m[k];
    })), __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p) && __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: !0 });
    __exportStar(require_boot(), exports);
    __exportStar(require_embed(), exports);
    __exportStar(require_enum(), exports);
    __exportStar(require_extension(), exports);
    __exportStar(require_file(), exports);
    __exportStar(require_message2(), exports);
    __exportStar(require_service(), exports);
    __exportStar(require_symbols(), exports);
    __exportStar(require_scalar2(), exports);
    __exportStar(require_types2(), exports);
  }
});

// javascript/node_modules/protobufjs/src/util/aspromise.js
var require_aspromise = __commonJS({
  "javascript/node_modules/protobufjs/src/util/aspromise.js"(exports, module) {
    "use strict";
    module.exports = asPromise;
    function asPromise(fn, ctx) {
      for (var params = new Array(arguments.length - 1), offset = 0, index = 2, pending = !0; index < arguments.length; )
        params[offset++] = arguments[index++];
      return new Promise(function(resolve, reject) {
        params[offset] = function(err) {
          if (pending)
            if (pending = !1, err)
              reject(err);
            else {
              for (var params2 = new Array(arguments.length - 1), offset2 = 0; offset2 < params2.length; )
                params2[offset2++] = arguments[offset2];
              resolve.apply(null, params2);
            }
        };
        try {
          fn.apply(ctx || null, params);
        } catch (err) {
          pending && (pending = !1, reject(err));
        }
      });
    }
  }
});

// javascript/node_modules/protobufjs/src/util/base64.js
var require_base64 = __commonJS({
  "javascript/node_modules/protobufjs/src/util/base64.js"(exports) {
    "use strict";
    var base64 = exports;
    base64.length = function(string) {
      var p = string.length;
      if (!p)
        return 0;
      for (; p > 0 && string.charAt(p - 1) === "="; )
        --p;
      return Math.floor(p * 3 / 4);
    };
    var b64 = new Array(64), s64 = new Array(123);
    for (i = 0; i < 64; )
      s64[b64[i] = i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : i - 59 | 43] = i++;
    var i;
    s64[45] = 62;
    s64[95] = 63;
    base64.encode = function(buffer, start, end) {
      for (var parts = null, chunk = [], i2 = 0, j = 0, t; start < end; ) {
        var b = buffer[start++];
        switch (j) {
          case 0:
            chunk[i2++] = b64[b >> 2], t = (b & 3) << 4, j = 1;
            break;
          case 1:
            chunk[i2++] = b64[t | b >> 4], t = (b & 15) << 2, j = 2;
            break;
          case 2:
            chunk[i2++] = b64[t | b >> 6], chunk[i2++] = b64[b & 63], j = 0;
            break;
        }
        i2 > 8191 && ((parts || (parts = [])).push(String.fromCharCode.apply(String, chunk)), i2 = 0);
      }
      return j && (chunk[i2++] = b64[t], chunk[i2++] = 61, j === 1 && (chunk[i2++] = 61)), parts ? (i2 && parts.push(String.fromCharCode.apply(String, chunk.slice(0, i2))), parts.join("")) : String.fromCharCode.apply(String, chunk.slice(0, i2));
    };
    var invalidEncoding = "invalid encoding";
    base64.decode = function(string, buffer, offset) {
      for (var start = offset, j = 0, t, i2 = 0; i2 < string.length; ) {
        var c = string.charCodeAt(i2++);
        if (c === 61 && j > 1)
          break;
        if ((c = s64[c]) === void 0)
          throw Error(invalidEncoding);
        switch (j) {
          case 0:
            t = c, j = 1;
            break;
          case 1:
            buffer[offset++] = t << 2 | (c & 48) >> 4, t = c, j = 2;
            break;
          case 2:
            buffer[offset++] = (t & 15) << 4 | (c & 60) >> 2, t = c, j = 3;
            break;
          case 3:
            buffer[offset++] = (t & 3) << 6 | c, j = 0;
            break;
        }
      }
      if (j === 1)
        throw Error(invalidEncoding);
      return offset - start;
    };
    var base64Re = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, base64UrlRe = /[-_]/, base64UrlNoPaddingRe = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2}(?:==)?|[A-Za-z0-9_-]{3}=?)?$/;
    base64.test = function(string) {
      return base64Re.test(string) || base64UrlRe.test(string) && base64UrlNoPaddingRe.test(string);
    };
  }
});

// javascript/node_modules/protobufjs/src/util/eventemitter.js
var require_eventemitter = __commonJS({
  "javascript/node_modules/protobufjs/src/util/eventemitter.js"(exports, module) {
    "use strict";
    module.exports = EventEmitter;
    function EventEmitter() {
      this._listeners = /* @__PURE__ */ Object.create(null);
    }
    EventEmitter.prototype.on = function(evt, fn, ctx) {
      return (this._listeners[evt] || (this._listeners[evt] = [])).push({
        fn,
        ctx: ctx || this
      }), this;
    };
    EventEmitter.prototype.off = function(evt, fn) {
      if (evt === void 0)
        this._listeners = /* @__PURE__ */ Object.create(null);
      else if (fn === void 0)
        this._listeners[evt] = [];
      else {
        var listeners = this._listeners[evt];
        if (!listeners)
          return this;
        for (var i = 0; i < listeners.length; )
          listeners[i].fn === fn ? listeners.splice(i, 1) : ++i;
      }
      return this;
    };
    EventEmitter.prototype.emit = function(evt) {
      var listeners = this._listeners[evt];
      if (listeners) {
        for (var args = [], i = 1; i < arguments.length; )
          args.push(arguments[i++]);
        for (i = 0; i < listeners.length; )
          listeners[i].fn.apply(listeners[i++].ctx, args);
      }
      return this;
    };
  }
});

// javascript/node_modules/protobufjs/src/util/float.js
var require_float = __commonJS({
  "javascript/node_modules/protobufjs/src/util/float.js"(exports, module) {
    "use strict";
    module.exports = factory(factory);
    function factory(exports2) {
      return typeof Float32Array < "u" ? (function() {
        var f32 = new Float32Array([-0]), f8b = new Uint8Array(f32.buffer), le = f8b[3] === 128;
        function writeFloat_f32_cpy(val, buf, pos) {
          f32[0] = val, buf[pos] = f8b[0], buf[pos + 1] = f8b[1], buf[pos + 2] = f8b[2], buf[pos + 3] = f8b[3];
        }
        function writeFloat_f32_rev(val, buf, pos) {
          f32[0] = val, buf[pos] = f8b[3], buf[pos + 1] = f8b[2], buf[pos + 2] = f8b[1], buf[pos + 3] = f8b[0];
        }
        exports2.writeFloatLE = le ? writeFloat_f32_cpy : writeFloat_f32_rev, exports2.writeFloatBE = le ? writeFloat_f32_rev : writeFloat_f32_cpy;
        function readFloat_f32_cpy(buf, pos) {
          return f8b[0] = buf[pos], f8b[1] = buf[pos + 1], f8b[2] = buf[pos + 2], f8b[3] = buf[pos + 3], f32[0];
        }
        function readFloat_f32_rev(buf, pos) {
          return f8b[3] = buf[pos], f8b[2] = buf[pos + 1], f8b[1] = buf[pos + 2], f8b[0] = buf[pos + 3], f32[0];
        }
        exports2.readFloatLE = le ? readFloat_f32_cpy : readFloat_f32_rev, exports2.readFloatBE = le ? readFloat_f32_rev : readFloat_f32_cpy;
      })() : (function() {
        function writeFloat_ieee754(writeUint, val, buf, pos) {
          var sign = val < 0 ? 1 : 0;
          if (sign && (val = -val), val === 0)
            writeUint(1 / val > 0 ? (
              /* positive */
              0
            ) : (
              /* negative 0 */
              2147483648
            ), buf, pos);
          else if (isNaN(val))
            writeUint(2143289344, buf, pos);
          else if (val > 34028234663852886e22)
            writeUint((sign << 31 | 2139095040) >>> 0, buf, pos);
          else if (val < 11754943508222875e-54)
            writeUint((sign << 31 | Math.round(val / 1401298464324817e-60)) >>> 0, buf, pos);
          else {
            var exponent = Math.floor(Math.log(val) / Math.LN2), mantissa = Math.round(val * Math.pow(2, -exponent) * 8388608) & 8388607;
            writeUint((sign << 31 | exponent + 127 << 23 | mantissa) >>> 0, buf, pos);
          }
        }
        exports2.writeFloatLE = writeFloat_ieee754.bind(null, writeUintLE), exports2.writeFloatBE = writeFloat_ieee754.bind(null, writeUintBE);
        function readFloat_ieee754(readUint, buf, pos) {
          var uint = readUint(buf, pos), sign = (uint >> 31) * 2 + 1, exponent = uint >>> 23 & 255, mantissa = uint & 8388607;
          return exponent === 255 ? mantissa ? NaN : sign * (1 / 0) : exponent === 0 ? sign * 1401298464324817e-60 * mantissa : sign * Math.pow(2, exponent - 150) * (mantissa + 8388608);
        }
        exports2.readFloatLE = readFloat_ieee754.bind(null, readUintLE), exports2.readFloatBE = readFloat_ieee754.bind(null, readUintBE);
      })(), typeof Float64Array < "u" ? (function() {
        var f64 = new Float64Array([-0]), f8b = new Uint8Array(f64.buffer), le = f8b[7] === 128;
        function writeDouble_f64_cpy(val, buf, pos) {
          f64[0] = val, buf[pos] = f8b[0], buf[pos + 1] = f8b[1], buf[pos + 2] = f8b[2], buf[pos + 3] = f8b[3], buf[pos + 4] = f8b[4], buf[pos + 5] = f8b[5], buf[pos + 6] = f8b[6], buf[pos + 7] = f8b[7];
        }
        function writeDouble_f64_rev(val, buf, pos) {
          f64[0] = val, buf[pos] = f8b[7], buf[pos + 1] = f8b[6], buf[pos + 2] = f8b[5], buf[pos + 3] = f8b[4], buf[pos + 4] = f8b[3], buf[pos + 5] = f8b[2], buf[pos + 6] = f8b[1], buf[pos + 7] = f8b[0];
        }
        exports2.writeDoubleLE = le ? writeDouble_f64_cpy : writeDouble_f64_rev, exports2.writeDoubleBE = le ? writeDouble_f64_rev : writeDouble_f64_cpy;
        function readDouble_f64_cpy(buf, pos) {
          return f8b[0] = buf[pos], f8b[1] = buf[pos + 1], f8b[2] = buf[pos + 2], f8b[3] = buf[pos + 3], f8b[4] = buf[pos + 4], f8b[5] = buf[pos + 5], f8b[6] = buf[pos + 6], f8b[7] = buf[pos + 7], f64[0];
        }
        function readDouble_f64_rev(buf, pos) {
          return f8b[7] = buf[pos], f8b[6] = buf[pos + 1], f8b[5] = buf[pos + 2], f8b[4] = buf[pos + 3], f8b[3] = buf[pos + 4], f8b[2] = buf[pos + 5], f8b[1] = buf[pos + 6], f8b[0] = buf[pos + 7], f64[0];
        }
        exports2.readDoubleLE = le ? readDouble_f64_cpy : readDouble_f64_rev, exports2.readDoubleBE = le ? readDouble_f64_rev : readDouble_f64_cpy;
      })() : (function() {
        function writeDouble_ieee754(writeUint, off0, off1, val, buf, pos) {
          var sign = val < 0 ? 1 : 0;
          if (sign && (val = -val), val === 0)
            writeUint(0, buf, pos + off0), writeUint(1 / val > 0 ? (
              /* positive */
              0
            ) : (
              /* negative 0 */
              2147483648
            ), buf, pos + off1);
          else if (isNaN(val))
            writeUint(0, buf, pos + off0), writeUint(2146959360, buf, pos + off1);
          else if (val > 17976931348623157e292)
            writeUint(0, buf, pos + off0), writeUint((sign << 31 | 2146435072) >>> 0, buf, pos + off1);
          else {
            var mantissa;
            if (val < 22250738585072014e-324)
              mantissa = val / 5e-324, writeUint(mantissa >>> 0, buf, pos + off0), writeUint((sign << 31 | mantissa / 4294967296) >>> 0, buf, pos + off1);
            else {
              var exponent = Math.floor(Math.log(val) / Math.LN2);
              exponent === 1024 && (exponent = 1023), mantissa = val * Math.pow(2, -exponent), writeUint(mantissa * 4503599627370496 >>> 0, buf, pos + off0), writeUint((sign << 31 | exponent + 1023 << 20 | mantissa * 1048576 & 1048575) >>> 0, buf, pos + off1);
            }
          }
        }
        exports2.writeDoubleLE = writeDouble_ieee754.bind(null, writeUintLE, 0, 4), exports2.writeDoubleBE = writeDouble_ieee754.bind(null, writeUintBE, 4, 0);
        function readDouble_ieee754(readUint, off0, off1, buf, pos) {
          var lo = readUint(buf, pos + off0), hi = readUint(buf, pos + off1), sign = (hi >> 31) * 2 + 1, exponent = hi >>> 20 & 2047, mantissa = 4294967296 * (hi & 1048575) + lo;
          return exponent === 2047 ? mantissa ? NaN : sign * (1 / 0) : exponent === 0 ? sign * 5e-324 * mantissa : sign * Math.pow(2, exponent - 1075) * (mantissa + 4503599627370496);
        }
        exports2.readDoubleLE = readDouble_ieee754.bind(null, readUintLE, 0, 4), exports2.readDoubleBE = readDouble_ieee754.bind(null, readUintBE, 4, 0);
      })(), exports2;
    }
    function writeUintLE(val, buf, pos) {
      buf[pos] = val & 255, buf[pos + 1] = val >>> 8 & 255, buf[pos + 2] = val >>> 16 & 255, buf[pos + 3] = val >>> 24;
    }
    function writeUintBE(val, buf, pos) {
      buf[pos] = val >>> 24, buf[pos + 1] = val >>> 16 & 255, buf[pos + 2] = val >>> 8 & 255, buf[pos + 3] = val & 255;
    }
    function readUintLE(buf, pos) {
      return (buf[pos] | buf[pos + 1] << 8 | buf[pos + 2] << 16 | buf[pos + 3] << 24) >>> 0;
    }
    function readUintBE(buf, pos) {
      return (buf[pos] << 24 | buf[pos + 1] << 16 | buf[pos + 2] << 8 | buf[pos + 3]) >>> 0;
    }
  }
});

// javascript/node_modules/protobufjs/src/util/utf8.js
var require_utf8 = __commonJS({
  "javascript/node_modules/protobufjs/src/util/utf8.js"(exports) {
    "use strict";
    var utf8 = exports, looseDecoder = new TextDecoder("utf-8", { ignoreBOM: !0 }), strictDecoder, TEXT_DECODER_MIN_LENGTH = 64;
    try {
      strictDecoder = new TextDecoder("utf-8", { fatal: !0, ignoreBOM: !0 });
    } catch {
      strictDecoder = looseDecoder;
    }
    utf8.length = function(string) {
      for (var len = 0, c = 0, i = 0; i < string.length; ++i)
        c = string.charCodeAt(i), c < 128 ? len += 1 : c < 2048 ? len += 2 : (c & 64512) === 55296 && (string.charCodeAt(i + 1) & 64512) === 56320 ? (++i, len += 4) : len += 3;
      return len;
    };
    function utf8_read_decoder(decoder, buffer, start, end) {
      var source = start === 0 && end === buffer.length ? buffer : buffer.subarray(start, end);
      return decoder.decode(source);
    }
    utf8.read = function(buffer, start, end) {
      if (end - start < 1)
        return "";
      if (end - start >= TEXT_DECODER_MIN_LENGTH)
        return utf8_read_decoder(looseDecoder, buffer, start, end);
      for (var str = "", i = start, c1, c2, c3, c4, c5, c6, c7, c8; i + 7 < end; i += 8) {
        if (c1 = buffer[i], c2 = buffer[i + 1], c3 = buffer[i + 2], c4 = buffer[i + 3], c5 = buffer[i + 4], c6 = buffer[i + 5], c7 = buffer[i + 6], c8 = buffer[i + 7], (c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8) & 128)
          return str + utf8_read_decoder(looseDecoder, buffer, i, end);
        str += String.fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8);
      }
      for (; i < end; ++i) {
        if (c1 = buffer[i], c1 & 128)
          return str + utf8_read_decoder(looseDecoder, buffer, i, end);
        str += String.fromCharCode(c1);
      }
      return str;
    };
    utf8.readStrict = function(buffer, start, end) {
      if (end - start < 1)
        return "";
      if (end - start >= TEXT_DECODER_MIN_LENGTH)
        return utf8_read_decoder(strictDecoder, buffer, start, end);
      for (var str = "", i = start, c1, c2, c3, c4, c5, c6, c7, c8; i + 7 < end; i += 8) {
        if (c1 = buffer[i], c2 = buffer[i + 1], c3 = buffer[i + 2], c4 = buffer[i + 3], c5 = buffer[i + 4], c6 = buffer[i + 5], c7 = buffer[i + 6], c8 = buffer[i + 7], (c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8) & 128)
          return str + utf8_read_decoder(strictDecoder, buffer, i, end);
        str += String.fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8);
      }
      for (; i < end; ++i) {
        if (c1 = buffer[i], c1 & 128)
          return str + utf8_read_decoder(strictDecoder, buffer, i, end);
        str += String.fromCharCode(c1);
      }
      return str;
    };
    utf8.write = function(string, buffer, offset) {
      for (var start = offset, c1, c2, i = 0; i < string.length; ++i)
        c1 = string.charCodeAt(i), c1 < 128 ? buffer[offset++] = c1 : c1 < 2048 ? (buffer[offset++] = c1 >> 6 | 192, buffer[offset++] = c1 & 63 | 128) : (c1 & 64512) === 55296 && ((c2 = string.charCodeAt(i + 1)) & 64512) === 56320 ? (c1 = 65536 + ((c1 & 1023) << 10) + (c2 & 1023), ++i, buffer[offset++] = c1 >> 18 | 240, buffer[offset++] = c1 >> 12 & 63 | 128, buffer[offset++] = c1 >> 6 & 63 | 128, buffer[offset++] = c1 & 63 | 128) : (buffer[offset++] = c1 >> 12 | 224, buffer[offset++] = c1 >> 6 & 63 | 128, buffer[offset++] = c1 & 63 | 128);
      return offset - start;
    };
  }
});

// javascript/node_modules/protobufjs/src/util/pool.js
var require_pool = __commonJS({
  "javascript/node_modules/protobufjs/src/util/pool.js"(exports, module) {
    "use strict";
    module.exports = pool;
    function pool(alloc, slice, size) {
      var SIZE = size || 8192, MAX = SIZE >>> 1, slab = null, offset = SIZE;
      return function(size2) {
        if (size2 < 1 || size2 > MAX)
          return alloc(size2);
        offset + size2 > SIZE && (slab = alloc(SIZE), offset = 0);
        var buf = slice.call(slab, offset, offset += size2);
        return offset & 7 && (offset = (offset | 7) + 1), buf;
      };
    }
  }
});

// javascript/node_modules/protobufjs/src/util/longbits.js
var require_longbits = __commonJS({
  "javascript/node_modules/protobufjs/src/util/longbits.js"(exports, module) {
    "use strict";
    module.exports = LongBits;
    var Long2;
    function LongBits(lo, hi) {
      this.lo = lo >>> 0, this.hi = hi >>> 0;
    }
    var zero = LongBits.zero = new LongBits(0, 0);
    zero.toNumber = function() {
      return 0;
    };
    zero.zzEncode = zero.zzDecode = function() {
      return this;
    };
    zero.length = function() {
      return 1;
    };
    var zeroHash = LongBits.zeroHash = "\0\0\0\0\0\0\0\0";
    LongBits.fromNumber = function(value) {
      if (value === 0)
        return zero;
      var sign = value < 0;
      sign && (value = -value);
      var lo = value >>> 0, hi = (value - lo) / 4294967296 >>> 0;
      return sign && (hi = ~hi >>> 0, lo = ~lo >>> 0, ++lo > 4294967295 && (lo = 0, ++hi > 4294967295 && (hi = 0))), new LongBits(lo, hi);
    };
    LongBits.from = function(value) {
      if (typeof value == "number")
        return LongBits.fromNumber(value);
      if (typeof value == "string" || value instanceof String)
        if (Long2)
          value = Long2.fromString(value);
        else
          return LongBits.fromNumber(parseInt(value, 10));
      return value.low || value.high ? new LongBits(value.low >>> 0, value.high >>> 0) : zero;
    };
    LongBits.prototype.toNumber = function(unsigned) {
      if (!unsigned && this.hi >>> 31) {
        var lo = ~this.lo + 1 >>> 0, hi = ~this.hi >>> 0;
        return lo || (hi = hi + 1 >>> 0), -(lo + hi * 4294967296);
      }
      return this.lo + this.hi * 4294967296;
    };
    LongBits.prototype.toLong = function(unsigned) {
      return Long2 ? new Long2(this.lo | 0, this.hi | 0, !!unsigned) : { low: this.lo | 0, high: this.hi | 0, unsigned: !!unsigned };
    };
    var charCodeAt = String.prototype.charCodeAt;
    LongBits.fromHash = function(hash) {
      return hash === zeroHash ? zero : new LongBits(
        (charCodeAt.call(hash, 0) | charCodeAt.call(hash, 1) << 8 | charCodeAt.call(hash, 2) << 16 | charCodeAt.call(hash, 3) << 24) >>> 0,
        (charCodeAt.call(hash, 4) | charCodeAt.call(hash, 5) << 8 | charCodeAt.call(hash, 6) << 16 | charCodeAt.call(hash, 7) << 24) >>> 0
      );
    };
    LongBits.prototype.toHash = function() {
      return String.fromCharCode(
        this.lo & 255,
        this.lo >>> 8 & 255,
        this.lo >>> 16 & 255,
        this.lo >>> 24,
        this.hi & 255,
        this.hi >>> 8 & 255,
        this.hi >>> 16 & 255,
        this.hi >>> 24
      );
    };
    LongBits.prototype.zzEncode = function() {
      var mask = this.hi >> 31;
      return this.hi = ((this.hi << 1 | this.lo >>> 31) ^ mask) >>> 0, this.lo = (this.lo << 1 ^ mask) >>> 0, this;
    };
    LongBits.prototype.zzDecode = function() {
      var mask = -(this.lo & 1);
      return this.lo = ((this.lo >>> 1 | this.hi << 31) ^ mask) >>> 0, this.hi = (this.hi >>> 1 ^ mask) >>> 0, this;
    };
    LongBits.prototype.length = function() {
      var part0 = this.lo, part1 = (this.lo >>> 28 | this.hi << 4) >>> 0, part2 = this.hi >>> 24;
      return part2 === 0 ? part1 === 0 ? part0 < 16384 ? part0 < 128 ? 1 : 2 : part0 < 2097152 ? 3 : 4 : part1 < 16384 ? part1 < 128 ? 5 : 6 : part1 < 2097152 ? 7 : 8 : part2 < 128 ? 9 : 10;
    };
    LongBits._configure = function(Long_) {
      Long2 = Long_;
    };
  }
});

// javascript/node_modules/long/umd/index.js
var require_umd = __commonJS({
  "javascript/node_modules/long/umd/index.js"(exports, module) {
    (function(global2, factory) {
      function preferDefault(exports2) {
        return exports2.default || exports2;
      }
      typeof define == "function" && define.amd ? define([], function() {
        var exports2 = {};
        return factory(exports2), preferDefault(exports2);
      }) : typeof exports == "object" ? (factory(exports), typeof module == "object" && (module.exports = preferDefault(exports))) : (function() {
        var exports2 = {};
        factory(exports2), global2.Long = preferDefault(exports2);
      })();
    })(
      typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : exports,
      function(_exports) {
        "use strict";
        Object.defineProperty(_exports, "__esModule", {
          value: !0
        }), _exports.default = void 0;
        var wasm2 = null;
        try {
          wasm2 = new WebAssembly.Instance(
            new WebAssembly.Module(
              new Uint8Array([
                // \0asm
                0,
                97,
                115,
                109,
                // version 1
                1,
                0,
                0,
                0,
                // section "type"
                1,
                13,
                2,
                // 0, () => i32
                96,
                0,
                1,
                127,
                // 1, (i32, i32, i32, i32) => i32
                96,
                4,
                127,
                127,
                127,
                127,
                1,
                127,
                // section "function"
                3,
                7,
                6,
                // 0, type 0
                0,
                // 1, type 1
                1,
                // 2, type 1
                1,
                // 3, type 1
                1,
                // 4, type 1
                1,
                // 5, type 1
                1,
                // section "global"
                6,
                6,
                1,
                // 0, "high", mutable i32
                127,
                1,
                65,
                0,
                11,
                // section "export"
                7,
                50,
                6,
                // 0, "mul"
                3,
                109,
                117,
                108,
                0,
                1,
                // 1, "div_s"
                5,
                100,
                105,
                118,
                95,
                115,
                0,
                2,
                // 2, "div_u"
                5,
                100,
                105,
                118,
                95,
                117,
                0,
                3,
                // 3, "rem_s"
                5,
                114,
                101,
                109,
                95,
                115,
                0,
                4,
                // 4, "rem_u"
                5,
                114,
                101,
                109,
                95,
                117,
                0,
                5,
                // 5, "get_high"
                8,
                103,
                101,
                116,
                95,
                104,
                105,
                103,
                104,
                0,
                0,
                // section "code"
                10,
                191,
                1,
                6,
                // 0, "get_high"
                4,
                0,
                35,
                0,
                11,
                // 1, "mul"
                36,
                1,
                1,
                126,
                32,
                0,
                173,
                32,
                1,
                173,
                66,
                32,
                134,
                132,
                32,
                2,
                173,
                32,
                3,
                173,
                66,
                32,
                134,
                132,
                126,
                34,
                4,
                66,
                32,
                135,
                167,
                36,
                0,
                32,
                4,
                167,
                11,
                // 2, "div_s"
                36,
                1,
                1,
                126,
                32,
                0,
                173,
                32,
                1,
                173,
                66,
                32,
                134,
                132,
                32,
                2,
                173,
                32,
                3,
                173,
                66,
                32,
                134,
                132,
                127,
                34,
                4,
                66,
                32,
                135,
                167,
                36,
                0,
                32,
                4,
                167,
                11,
                // 3, "div_u"
                36,
                1,
                1,
                126,
                32,
                0,
                173,
                32,
                1,
                173,
                66,
                32,
                134,
                132,
                32,
                2,
                173,
                32,
                3,
                173,
                66,
                32,
                134,
                132,
                128,
                34,
                4,
                66,
                32,
                135,
                167,
                36,
                0,
                32,
                4,
                167,
                11,
                // 4, "rem_s"
                36,
                1,
                1,
                126,
                32,
                0,
                173,
                32,
                1,
                173,
                66,
                32,
                134,
                132,
                32,
                2,
                173,
                32,
                3,
                173,
                66,
                32,
                134,
                132,
                129,
                34,
                4,
                66,
                32,
                135,
                167,
                36,
                0,
                32,
                4,
                167,
                11,
                // 5, "rem_u"
                36,
                1,
                1,
                126,
                32,
                0,
                173,
                32,
                1,
                173,
                66,
                32,
                134,
                132,
                32,
                2,
                173,
                32,
                3,
                173,
                66,
                32,
                134,
                132,
                130,
                34,
                4,
                66,
                32,
                135,
                167,
                36,
                0,
                32,
                4,
                167,
                11
              ])
            ),
            {}
          ).exports;
        } catch {
        }
        function Long2(low, high, unsigned) {
          this.low = low | 0, this.high = high | 0, this.unsigned = !!unsigned;
        }
        Long2.prototype.__isLong__, Object.defineProperty(Long2.prototype, "__isLong__", {
          value: !0
        });
        function isLong2(obj) {
          return (obj && obj.__isLong__) === !0;
        }
        function ctz322(value) {
          var c = Math.clz32(value & -value);
          return value ? 31 - c : c;
        }
        Long2.isLong = isLong2;
        var INT_CACHE2 = {}, UINT_CACHE2 = {};
        function fromInt2(value, unsigned) {
          var obj, cachedObj, cache;
          return unsigned ? (value >>>= 0, (cache = 0 <= value && value < 256) && (cachedObj = UINT_CACHE2[value], cachedObj) ? cachedObj : (obj = fromBits2(value, 0, !0), cache && (UINT_CACHE2[value] = obj), obj)) : (value |= 0, (cache = -128 <= value && value < 128) && (cachedObj = INT_CACHE2[value], cachedObj) ? cachedObj : (obj = fromBits2(value, value < 0 ? -1 : 0, !1), cache && (INT_CACHE2[value] = obj), obj));
        }
        Long2.fromInt = fromInt2;
        function fromNumber2(value, unsigned) {
          if (isNaN(value)) return unsigned ? UZERO2 : ZERO2;
          if (unsigned) {
            if (value < 0) return UZERO2;
            if (value >= TWO_PWR_64_DBL2) return MAX_UNSIGNED_VALUE2;
          } else {
            if (value <= -TWO_PWR_63_DBL2) return MIN_VALUE2;
            if (value + 1 >= TWO_PWR_63_DBL2) return MAX_VALUE2;
          }
          return value < 0 ? fromNumber2(-value, unsigned).neg() : fromBits2(
            value % TWO_PWR_32_DBL2 | 0,
            value / TWO_PWR_32_DBL2 | 0,
            unsigned
          );
        }
        Long2.fromNumber = fromNumber2;
        function fromBits2(lowBits, highBits, unsigned) {
          return new Long2(lowBits, highBits, unsigned);
        }
        Long2.fromBits = fromBits2;
        var pow_dbl2 = Math.pow;
        function fromString2(str, unsigned, radix) {
          if (str.length === 0) throw Error("empty string");
          if (typeof unsigned == "number" ? (radix = unsigned, unsigned = !1) : unsigned = !!unsigned, str === "NaN" || str === "Infinity" || str === "+Infinity" || str === "-Infinity")
            return unsigned ? UZERO2 : ZERO2;
          if (radix = radix || 10, radix < 2 || 36 < radix) throw RangeError("radix");
          var p;
          if ((p = str.indexOf("-")) > 0) throw Error("interior hyphen");
          if (p === 0)
            return fromString2(str.substring(1), unsigned, radix).neg();
          for (var radixToPower = fromNumber2(pow_dbl2(radix, 8)), result = ZERO2, i = 0; i < str.length; i += 8) {
            var size = Math.min(8, str.length - i), value = parseInt(str.substring(i, i + size), radix);
            if (size < 8) {
              var power = fromNumber2(pow_dbl2(radix, size));
              result = result.mul(power).add(fromNumber2(value));
            } else
              result = result.mul(radixToPower), result = result.add(fromNumber2(value));
          }
          return result.unsigned = unsigned, result;
        }
        Long2.fromString = fromString2;
        function fromValue2(val, unsigned) {
          return typeof val == "number" ? fromNumber2(val, unsigned) : typeof val == "string" ? fromString2(val, unsigned) : fromBits2(
            val.low,
            val.high,
            typeof unsigned == "boolean" ? unsigned : val.unsigned
          );
        }
        Long2.fromValue = fromValue2;
        var TWO_PWR_16_DBL2 = 65536, TWO_PWR_24_DBL2 = 1 << 24, TWO_PWR_32_DBL2 = TWO_PWR_16_DBL2 * TWO_PWR_16_DBL2, TWO_PWR_64_DBL2 = TWO_PWR_32_DBL2 * TWO_PWR_32_DBL2, TWO_PWR_63_DBL2 = TWO_PWR_64_DBL2 / 2, TWO_PWR_242 = fromInt2(TWO_PWR_24_DBL2), ZERO2 = fromInt2(0);
        Long2.ZERO = ZERO2;
        var UZERO2 = fromInt2(0, !0);
        Long2.UZERO = UZERO2;
        var ONE2 = fromInt2(1);
        Long2.ONE = ONE2;
        var UONE2 = fromInt2(1, !0);
        Long2.UONE = UONE2;
        var NEG_ONE2 = fromInt2(-1);
        Long2.NEG_ONE = NEG_ONE2;
        var MAX_VALUE2 = fromBits2(-1, 2147483647, !1);
        Long2.MAX_VALUE = MAX_VALUE2;
        var MAX_UNSIGNED_VALUE2 = fromBits2(-1, -1, !0);
        Long2.MAX_UNSIGNED_VALUE = MAX_UNSIGNED_VALUE2;
        var MIN_VALUE2 = fromBits2(0, -2147483648, !1);
        Long2.MIN_VALUE = MIN_VALUE2;
        var LongPrototype2 = Long2.prototype;
        LongPrototype2.toInt = function() {
          return this.unsigned ? this.low >>> 0 : this.low;
        }, LongPrototype2.toNumber = function() {
          return this.unsigned ? (this.high >>> 0) * TWO_PWR_32_DBL2 + (this.low >>> 0) : this.high * TWO_PWR_32_DBL2 + (this.low >>> 0);
        }, LongPrototype2.toString = function(radix) {
          if (radix = radix || 10, radix < 2 || 36 < radix) throw RangeError("radix");
          if (this.isZero()) return "0";
          if (this.isNegative())
            if (this.eq(MIN_VALUE2)) {
              var radixLong = fromNumber2(radix), div = this.div(radixLong), rem1 = div.mul(radixLong).sub(this);
              return div.toString(radix) + rem1.toInt().toString(radix);
            } else return "-" + this.neg().toString(radix);
          for (var radixToPower = fromNumber2(pow_dbl2(radix, 6), this.unsigned), rem = this, result = ""; ; ) {
            var remDiv = rem.div(radixToPower), intval = rem.sub(remDiv.mul(radixToPower)).toInt() >>> 0, digits = intval.toString(radix);
            if (rem = remDiv, rem.isZero()) return digits + result;
            for (; digits.length < 6; ) digits = "0" + digits;
            result = "" + digits + result;
          }
        }, LongPrototype2.getHighBits = function() {
          return this.high;
        }, LongPrototype2.getHighBitsUnsigned = function() {
          return this.high >>> 0;
        }, LongPrototype2.getLowBits = function() {
          return this.low;
        }, LongPrototype2.getLowBitsUnsigned = function() {
          return this.low >>> 0;
        }, LongPrototype2.getNumBitsAbs = function() {
          if (this.isNegative())
            return this.eq(MIN_VALUE2) ? 64 : this.neg().getNumBitsAbs();
          for (var val = this.high != 0 ? this.high : this.low, bit = 31; bit > 0 && (val & 1 << bit) == 0; bit--) ;
          return this.high != 0 ? bit + 33 : bit + 1;
        }, LongPrototype2.isSafeInteger = function() {
          var top11Bits = this.high >> 21;
          return top11Bits ? this.unsigned ? !1 : top11Bits === -1 && !(this.low === 0 && this.high === -2097152) : !0;
        }, LongPrototype2.isZero = function() {
          return this.high === 0 && this.low === 0;
        }, LongPrototype2.eqz = LongPrototype2.isZero, LongPrototype2.isNegative = function() {
          return !this.unsigned && this.high < 0;
        }, LongPrototype2.isPositive = function() {
          return this.unsigned || this.high >= 0;
        }, LongPrototype2.isOdd = function() {
          return (this.low & 1) === 1;
        }, LongPrototype2.isEven = function() {
          return (this.low & 1) === 0;
        }, LongPrototype2.equals = function(other) {
          return isLong2(other) || (other = fromValue2(other)), this.unsigned !== other.unsigned && this.high >>> 31 === 1 && other.high >>> 31 === 1 ? !1 : this.high === other.high && this.low === other.low;
        }, LongPrototype2.eq = LongPrototype2.equals, LongPrototype2.notEquals = function(other) {
          return !this.eq(
            /* validates */
            other
          );
        }, LongPrototype2.neq = LongPrototype2.notEquals, LongPrototype2.ne = LongPrototype2.notEquals, LongPrototype2.lessThan = function(other) {
          return this.comp(
            /* validates */
            other
          ) < 0;
        }, LongPrototype2.lt = LongPrototype2.lessThan, LongPrototype2.lessThanOrEqual = function(other) {
          return this.comp(
            /* validates */
            other
          ) <= 0;
        }, LongPrototype2.lte = LongPrototype2.lessThanOrEqual, LongPrototype2.le = LongPrototype2.lessThanOrEqual, LongPrototype2.greaterThan = function(other) {
          return this.comp(
            /* validates */
            other
          ) > 0;
        }, LongPrototype2.gt = LongPrototype2.greaterThan, LongPrototype2.greaterThanOrEqual = function(other) {
          return this.comp(
            /* validates */
            other
          ) >= 0;
        }, LongPrototype2.gte = LongPrototype2.greaterThanOrEqual, LongPrototype2.ge = LongPrototype2.greaterThanOrEqual, LongPrototype2.compare = function(other) {
          if (isLong2(other) || (other = fromValue2(other)), this.eq(other)) return 0;
          var thisNeg = this.isNegative(), otherNeg = other.isNegative();
          return thisNeg && !otherNeg ? -1 : !thisNeg && otherNeg ? 1 : this.unsigned ? other.high >>> 0 > this.high >>> 0 || other.high === this.high && other.low >>> 0 > this.low >>> 0 ? -1 : 1 : this.sub(other).isNegative() ? -1 : 1;
        }, LongPrototype2.comp = LongPrototype2.compare, LongPrototype2.negate = function() {
          return !this.unsigned && this.eq(MIN_VALUE2) ? MIN_VALUE2 : this.not().add(ONE2);
        }, LongPrototype2.neg = LongPrototype2.negate, LongPrototype2.add = function(addend) {
          isLong2(addend) || (addend = fromValue2(addend));
          var a48 = this.high >>> 16, a32 = this.high & 65535, a16 = this.low >>> 16, a00 = this.low & 65535, b48 = addend.high >>> 16, b32 = addend.high & 65535, b16 = addend.low >>> 16, b00 = addend.low & 65535, c48 = 0, c32 = 0, c16 = 0, c00 = 0;
          return c00 += a00 + b00, c16 += c00 >>> 16, c00 &= 65535, c16 += a16 + b16, c32 += c16 >>> 16, c16 &= 65535, c32 += a32 + b32, c48 += c32 >>> 16, c32 &= 65535, c48 += a48 + b48, c48 &= 65535, fromBits2(c16 << 16 | c00, c48 << 16 | c32, this.unsigned);
        }, LongPrototype2.subtract = function(subtrahend) {
          return isLong2(subtrahend) || (subtrahend = fromValue2(subtrahend)), this.add(subtrahend.neg());
        }, LongPrototype2.sub = LongPrototype2.subtract, LongPrototype2.multiply = function(multiplier) {
          if (this.isZero()) return this;
          if (isLong2(multiplier) || (multiplier = fromValue2(multiplier)), wasm2) {
            var low = wasm2.mul(
              this.low,
              this.high,
              multiplier.low,
              multiplier.high
            );
            return fromBits2(low, wasm2.get_high(), this.unsigned);
          }
          if (multiplier.isZero()) return this.unsigned ? UZERO2 : ZERO2;
          if (this.eq(MIN_VALUE2)) return multiplier.isOdd() ? MIN_VALUE2 : ZERO2;
          if (multiplier.eq(MIN_VALUE2)) return this.isOdd() ? MIN_VALUE2 : ZERO2;
          if (this.isNegative())
            return multiplier.isNegative() ? this.neg().mul(multiplier.neg()) : this.neg().mul(multiplier).neg();
          if (multiplier.isNegative())
            return this.mul(multiplier.neg()).neg();
          if (this.lt(TWO_PWR_242) && multiplier.lt(TWO_PWR_242))
            return fromNumber2(
              this.toNumber() * multiplier.toNumber(),
              this.unsigned
            );
          var a48 = this.high >>> 16, a32 = this.high & 65535, a16 = this.low >>> 16, a00 = this.low & 65535, b48 = multiplier.high >>> 16, b32 = multiplier.high & 65535, b16 = multiplier.low >>> 16, b00 = multiplier.low & 65535, c48 = 0, c32 = 0, c16 = 0, c00 = 0;
          return c00 += a00 * b00, c16 += c00 >>> 16, c00 &= 65535, c16 += a16 * b00, c32 += c16 >>> 16, c16 &= 65535, c16 += a00 * b16, c32 += c16 >>> 16, c16 &= 65535, c32 += a32 * b00, c48 += c32 >>> 16, c32 &= 65535, c32 += a16 * b16, c48 += c32 >>> 16, c32 &= 65535, c32 += a00 * b32, c48 += c32 >>> 16, c32 &= 65535, c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48, c48 &= 65535, fromBits2(c16 << 16 | c00, c48 << 16 | c32, this.unsigned);
        }, LongPrototype2.mul = LongPrototype2.multiply, LongPrototype2.divide = function(divisor) {
          if (isLong2(divisor) || (divisor = fromValue2(divisor)), divisor.isZero()) throw Error("division by zero");
          if (wasm2) {
            if (!this.unsigned && this.high === -2147483648 && divisor.low === -1 && divisor.high === -1)
              return this;
            var low = (this.unsigned ? wasm2.div_u : wasm2.div_s)(
              this.low,
              this.high,
              divisor.low,
              divisor.high
            );
            return fromBits2(low, wasm2.get_high(), this.unsigned);
          }
          if (this.isZero()) return this.unsigned ? UZERO2 : ZERO2;
          var approx, rem, res;
          if (this.unsigned) {
            if (divisor.unsigned || (divisor = divisor.toUnsigned()), divisor.gt(this)) return UZERO2;
            if (divisor.gt(this.shru(1)))
              return UONE2;
            res = UZERO2;
          } else {
            if (this.eq(MIN_VALUE2)) {
              if (divisor.eq(ONE2) || divisor.eq(NEG_ONE2))
                return MIN_VALUE2;
              if (divisor.eq(MIN_VALUE2)) return ONE2;
              var halfThis = this.shr(1);
              return approx = halfThis.div(divisor).shl(1), approx.eq(ZERO2) ? divisor.isNegative() ? ONE2 : NEG_ONE2 : (rem = this.sub(divisor.mul(approx)), res = approx.add(rem.div(divisor)), res);
            } else if (divisor.eq(MIN_VALUE2)) return this.unsigned ? UZERO2 : ZERO2;
            if (this.isNegative())
              return divisor.isNegative() ? this.neg().div(divisor.neg()) : this.neg().div(divisor).neg();
            if (divisor.isNegative()) return this.div(divisor.neg()).neg();
            res = ZERO2;
          }
          for (rem = this; rem.gte(divisor); ) {
            approx = Math.max(1, Math.floor(rem.toNumber() / divisor.toNumber()));
            for (var log2 = Math.ceil(Math.log(approx) / Math.LN2), delta = log2 <= 48 ? 1 : pow_dbl2(2, log2 - 48), approxRes = fromNumber2(approx), approxRem = approxRes.mul(divisor); approxRem.isNegative() || approxRem.gt(rem); )
              approx -= delta, approxRes = fromNumber2(approx, this.unsigned), approxRem = approxRes.mul(divisor);
            approxRes.isZero() && (approxRes = ONE2), res = res.add(approxRes), rem = rem.sub(approxRem);
          }
          return res;
        }, LongPrototype2.div = LongPrototype2.divide, LongPrototype2.modulo = function(divisor) {
          if (isLong2(divisor) || (divisor = fromValue2(divisor)), wasm2) {
            var low = (this.unsigned ? wasm2.rem_u : wasm2.rem_s)(
              this.low,
              this.high,
              divisor.low,
              divisor.high
            );
            return fromBits2(low, wasm2.get_high(), this.unsigned);
          }
          return this.sub(this.div(divisor).mul(divisor));
        }, LongPrototype2.mod = LongPrototype2.modulo, LongPrototype2.rem = LongPrototype2.modulo, LongPrototype2.not = function() {
          return fromBits2(~this.low, ~this.high, this.unsigned);
        }, LongPrototype2.countLeadingZeros = function() {
          return this.high ? Math.clz32(this.high) : Math.clz32(this.low) + 32;
        }, LongPrototype2.clz = LongPrototype2.countLeadingZeros, LongPrototype2.countTrailingZeros = function() {
          return this.low ? ctz322(this.low) : ctz322(this.high) + 32;
        }, LongPrototype2.ctz = LongPrototype2.countTrailingZeros, LongPrototype2.and = function(other) {
          return isLong2(other) || (other = fromValue2(other)), fromBits2(
            this.low & other.low,
            this.high & other.high,
            this.unsigned
          );
        }, LongPrototype2.or = function(other) {
          return isLong2(other) || (other = fromValue2(other)), fromBits2(
            this.low | other.low,
            this.high | other.high,
            this.unsigned
          );
        }, LongPrototype2.xor = function(other) {
          return isLong2(other) || (other = fromValue2(other)), fromBits2(
            this.low ^ other.low,
            this.high ^ other.high,
            this.unsigned
          );
        }, LongPrototype2.shiftLeft = function(numBits) {
          return isLong2(numBits) && (numBits = numBits.toInt()), (numBits &= 63) === 0 ? this : numBits < 32 ? fromBits2(
            this.low << numBits,
            this.high << numBits | this.low >>> 32 - numBits,
            this.unsigned
          ) : fromBits2(0, this.low << numBits - 32, this.unsigned);
        }, LongPrototype2.shl = LongPrototype2.shiftLeft, LongPrototype2.shiftRight = function(numBits) {
          return isLong2(numBits) && (numBits = numBits.toInt()), (numBits &= 63) === 0 ? this : numBits < 32 ? fromBits2(
            this.low >>> numBits | this.high << 32 - numBits,
            this.high >> numBits,
            this.unsigned
          ) : fromBits2(
            this.high >> numBits - 32,
            this.high >= 0 ? 0 : -1,
            this.unsigned
          );
        }, LongPrototype2.shr = LongPrototype2.shiftRight, LongPrototype2.shiftRightUnsigned = function(numBits) {
          return isLong2(numBits) && (numBits = numBits.toInt()), (numBits &= 63) === 0 ? this : numBits < 32 ? fromBits2(
            this.low >>> numBits | this.high << 32 - numBits,
            this.high >>> numBits,
            this.unsigned
          ) : numBits === 32 ? fromBits2(this.high, 0, this.unsigned) : fromBits2(this.high >>> numBits - 32, 0, this.unsigned);
        }, LongPrototype2.shru = LongPrototype2.shiftRightUnsigned, LongPrototype2.shr_u = LongPrototype2.shiftRightUnsigned, LongPrototype2.rotateLeft = function(numBits) {
          var b;
          return isLong2(numBits) && (numBits = numBits.toInt()), (numBits &= 63) === 0 ? this : numBits === 32 ? fromBits2(this.high, this.low, this.unsigned) : numBits < 32 ? (b = 32 - numBits, fromBits2(
            this.low << numBits | this.high >>> b,
            this.high << numBits | this.low >>> b,
            this.unsigned
          )) : (numBits -= 32, b = 32 - numBits, fromBits2(
            this.high << numBits | this.low >>> b,
            this.low << numBits | this.high >>> b,
            this.unsigned
          ));
        }, LongPrototype2.rotl = LongPrototype2.rotateLeft, LongPrototype2.rotateRight = function(numBits) {
          var b;
          return isLong2(numBits) && (numBits = numBits.toInt()), (numBits &= 63) === 0 ? this : numBits === 32 ? fromBits2(this.high, this.low, this.unsigned) : numBits < 32 ? (b = 32 - numBits, fromBits2(
            this.high << b | this.low >>> numBits,
            this.low << b | this.high >>> numBits,
            this.unsigned
          )) : (numBits -= 32, b = 32 - numBits, fromBits2(
            this.low << b | this.high >>> numBits,
            this.high << b | this.low >>> numBits,
            this.unsigned
          ));
        }, LongPrototype2.rotr = LongPrototype2.rotateRight, LongPrototype2.toSigned = function() {
          return this.unsigned ? fromBits2(this.low, this.high, !1) : this;
        }, LongPrototype2.toUnsigned = function() {
          return this.unsigned ? this : fromBits2(this.low, this.high, !0);
        }, LongPrototype2.toBytes = function(le) {
          return le ? this.toBytesLE() : this.toBytesBE();
        }, LongPrototype2.toBytesLE = function() {
          var hi = this.high, lo = this.low;
          return [
            lo & 255,
            lo >>> 8 & 255,
            lo >>> 16 & 255,
            lo >>> 24,
            hi & 255,
            hi >>> 8 & 255,
            hi >>> 16 & 255,
            hi >>> 24
          ];
        }, LongPrototype2.toBytesBE = function() {
          var hi = this.high, lo = this.low;
          return [
            hi >>> 24,
            hi >>> 16 & 255,
            hi >>> 8 & 255,
            hi & 255,
            lo >>> 24,
            lo >>> 16 & 255,
            lo >>> 8 & 255,
            lo & 255
          ];
        }, Long2.fromBytes = function(bytes, unsigned, le) {
          return le ? Long2.fromBytesLE(bytes, unsigned) : Long2.fromBytesBE(bytes, unsigned);
        }, Long2.fromBytesLE = function(bytes, unsigned) {
          return new Long2(
            bytes[0] | bytes[1] << 8 | bytes[2] << 16 | bytes[3] << 24,
            bytes[4] | bytes[5] << 8 | bytes[6] << 16 | bytes[7] << 24,
            unsigned
          );
        }, Long2.fromBytesBE = function(bytes, unsigned) {
          return new Long2(
            bytes[4] << 24 | bytes[5] << 16 | bytes[6] << 8 | bytes[7],
            bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3],
            unsigned
          );
        }, typeof BigInt == "function" && (Long2.fromBigInt = function(value, unsigned) {
          var lowBits = Number(BigInt.asIntN(32, value)), highBits = Number(BigInt.asIntN(32, value >> BigInt(32)));
          return fromBits2(lowBits, highBits, unsigned);
        }, Long2.fromValue = function(value, unsigned) {
          return typeof value == "bigint" ? Long2.fromBigInt(value, unsigned) : fromValue2(value, unsigned);
        }, LongPrototype2.toBigInt = function() {
          var lowBigInt = BigInt(this.low >>> 0), highBigInt = BigInt(this.unsigned ? this.high >>> 0 : this.high);
          return highBigInt << BigInt(32) | lowBigInt;
        });
        var _default = _exports.default = Long2;
      }
    );
  }
});

// javascript/node_modules/protobufjs/src/util/minimal.js
var require_minimal = __commonJS({
  "javascript/node_modules/protobufjs/src/util/minimal.js"(exports) {
    "use strict";
    var util2 = exports;
    util2.asPromise = require_aspromise();
    util2.base64 = require_base64();
    util2.EventEmitter = require_eventemitter();
    util2.float = require_float();
    util2.utf8 = require_utf8();
    util2.pool = require_pool();
    util2.LongBits = require_longbits();
    function isUnsafeProperty(key) {
      return key === "__proto__" || key === "prototype" || key === "constructor";
    }
    util2.isUnsafeProperty = isUnsafeProperty;
    util2.isNode = !!(typeof global < "u" && global && global.process && global.process.versions && global.process.versions.node);
    util2.global = util2.isNode && global || typeof window < "u" && window || typeof self < "u" && self || typeof globalThis < "u" && globalThis || exports;
    util2.emptyArray = Object.freeze ? Object.freeze([]) : (
      /* istanbul ignore next */
      []
    );
    util2.emptyObject = Object.freeze ? Object.freeze({}) : (
      /* istanbul ignore next */
      {}
    );
    util2.isInteger = Number.isInteger || /* istanbul ignore next */
    function(value) {
      return typeof value == "number" && isFinite(value) && Math.floor(value) === value;
    };
    util2.isString = function(value) {
      return typeof value == "string" || value instanceof String;
    };
    util2.isObject = function(value) {
      return value && typeof value == "object";
    };
    util2.isset = /**
     * Checks if a property on a message is considered to be present.
     * @param {Object} obj Plain object or message instance
     * @param {string} prop Property name
     * @returns {boolean} `true` if considered to be present, otherwise `false`
     */
    util2.isSet = function(obj, prop) {
      var value = obj[prop];
      return value != null && Object.hasOwnProperty.call(obj, prop) ? typeof value != "object" || (Array.isArray(value) ? value.length : Object.keys(value).length) > 0 : !1;
    };
    util2.Buffer = (function() {
      try {
        var Buffer2 = util2.global.Buffer;
        return Buffer2.prototype.utf8Write || util2.isNode ? Buffer2 : (
          /* istanbul ignore next */
          null
        );
      } catch {
        return null;
      }
    })();
    util2.newBuffer = function(sizeOrArray) {
      var Buffer2 = util2.Buffer;
      return typeof sizeOrArray == "number" ? Buffer2 ? Buffer2.allocUnsafe(sizeOrArray) : new Uint8Array(sizeOrArray) : Buffer2 ? Buffer2.from(sizeOrArray) : new Uint8Array(sizeOrArray);
    };
    util2.rawField = function(id, wireType, data) {
      var out = [], tag = id << 3 | wireType;
      for (tag >>>= 0; tag > 127; )
        out.push(tag & 127 | 128), tag >>>= 7;
      out.push(tag);
      for (var i = 0; i < data.length; ++i)
        out.push(data[i]);
      return util2.newBuffer(out);
    };
    util2.Array = Uint8Array;
    util2.Long = /* istanbul ignore next */
    util2.global.dcodeIO && /* istanbul ignore next */
    util2.global.dcodeIO.Long || /* istanbul ignore next */
    util2.global.Long || (function() {
      try {
        var Long2 = require_umd();
        return Long2 && Long2.isLong ? Long2 : null;
      } catch {
        return null;
      }
    })();
    util2.key2Re = /^(?:true|false|0|1)$/;
    util2.key32Re = /^-?(?:0|[1-9][0-9]*)$/;
    util2.key64Re = /^(?:[\x00-\xff]{8}|-?(?:0|[1-9][0-9]*))$/;
    util2.longToHash = function(value) {
      return value ? util2.LongBits.from(value).toHash() : util2.LongBits.zeroHash;
    };
    util2.longFromHash = function(hash, unsigned) {
      var bits = util2.LongBits.fromHash(hash);
      return util2.Long ? util2.Long.fromBits(bits.lo, bits.hi, unsigned) : bits.toNumber(!!unsigned);
    };
    util2.longFromKey = function(key, unsigned) {
      return util2.key64Re.test(key) && !util2.key32Re.test(key) ? util2.longFromHash(key, unsigned) : key;
    };
    util2.boolFromKey = function(key) {
      return key === "true" || key === "1";
    };
    function merge(dst) {
      var ifNotSet = typeof arguments[arguments.length - 1] == "boolean", limit = ifNotSet ? arguments.length - 1 : arguments.length;
      ifNotSet = ifNotSet && arguments[arguments.length - 1];
      for (var a = 1; a < limit; ++a) {
        var src = arguments[a];
        if (src)
          for (var keys = Object.keys(src), i = 0; i < keys.length; ++i)
            !isUnsafeProperty(keys[i]) && (!ifNotSet || !Object.prototype.hasOwnProperty.call(dst, keys[i]) || dst[keys[i]] === void 0) && (dst[keys[i]] = src[keys[i]]);
      }
      return dst;
    }
    util2.merge = merge;
    util2.nestingLimit = 32;
    util2.recursionLimit = 100;
    util2.makeProp = function(obj, key, enumerable) {
      Object.prototype.hasOwnProperty.call(obj, key) || Object.defineProperty(obj, key, {
        enumerable: enumerable === void 0 ? !0 : enumerable,
        configurable: !0,
        writable: !0
      });
    };
    util2.lcFirst = function(str) {
      return str.charAt(0).toLowerCase() + str.substring(1);
    };
    function newError(name) {
      function CustomError(message, properties) {
        if (!(this instanceof CustomError))
          return new CustomError(message, properties);
        Object.defineProperty(this, "message", { get: function() {
          return message;
        } }), Error.captureStackTrace ? Error.captureStackTrace(this, CustomError) : Object.defineProperty(this, "stack", { value: new Error().stack || "" }), properties && merge(this, properties);
      }
      return CustomError.prototype = Object.create(Error.prototype, {
        constructor: {
          value: CustomError,
          writable: !0,
          enumerable: !1,
          configurable: !0
        },
        name: {
          get: function() {
            return name;
          },
          set: void 0,
          enumerable: !1,
          // configurable: false would accurately preserve the behavior of
          // the original, but I'm guessing that was not intentional.
          // For an actual error subclass, this property would
          // be configurable.
          configurable: !0
        },
        toString: {
          value: function() {
            return this.name + ": " + this.message;
          },
          writable: !0,
          enumerable: !1,
          configurable: !0
        }
      }), CustomError;
    }
    util2.newError = newError;
    util2.ProtocolError = newError("ProtocolError");
    util2.oneOfGetter = function(fieldNames) {
      for (var fieldMap = {}, i = 0; i < fieldNames.length; ++i)
        fieldMap[fieldNames[i]] = 1;
      return function() {
        for (var keys = Object.keys(this), i2 = keys.length - 1; i2 > -1; --i2)
          if (fieldMap[keys[i2]] === 1 && this[keys[i2]] !== void 0 && this[keys[i2]] !== null)
            return keys[i2];
      };
    };
    util2.oneOfSetter = function(fieldNames) {
      return function(name) {
        for (var i = 0; i < fieldNames.length; ++i)
          fieldNames[i] !== name && delete this[fieldNames[i]];
      };
    };
    util2.toJSONOptions = {
      longs: String,
      enums: String,
      bytes: String,
      json: !0
    };
  }
});

// javascript/node_modules/protobufjs/src/writer.js
var require_writer = __commonJS({
  "javascript/node_modules/protobufjs/src/writer.js"(exports, module) {
    "use strict";
    module.exports = Writer;
    var util2 = require_minimal(), BufferWriter, LongBits = util2.LongBits, base64 = util2.base64, utf8 = util2.utf8;
    function Writer() {
      this.pos = 0, this.buf = this.constructor.alloc(Writer.initialBufferSize), this.view = null, this.states = null;
    }
    Writer.initialBufferSize = 128;
    Object.defineProperty(Writer.prototype, "len", {
      configurable: !0,
      enumerable: !0,
      get: function() {
        return this.pos;
      }
    });
    var create4 = function() {
      return util2.Buffer ? function() {
        return (Writer.create = function() {
          return new BufferWriter();
        })();
      } : function() {
        return new Writer();
      };
    };
    Writer.create = create4();
    Writer.alloc = function(size) {
      return new Uint8Array(size);
    };
    Writer.alloc = util2.pool(Writer.alloc, Uint8Array.prototype.subarray);
    function sizeVarint32(value) {
      return value < 128 ? 1 : value < 16384 ? 2 : value < 2097152 ? 3 : value < 268435456 ? 4 : 5;
    }
    Writer.prototype._reserve = function(n) {
      var need = this.pos + n;
      if (need > this.buf.length) {
        var size = this.buf.length << 1;
        size < need && (size = need);
        var buf = this.constructor.alloc(size);
        buf.set(this.buf.subarray(0, this.pos), 0), this.buf = buf, this.view = null;
      }
    };
    function writeStringAscii(val, buf, pos) {
      for (var i = 0; i < val.length; )
        buf[pos++] = val.charCodeAt(i++);
    }
    function writeVarint32(val, buf, pos) {
      for (; val > 127; )
        buf[pos++] = val & 127 | 128, val >>>= 7;
      return buf[pos] = val, pos + 1;
    }
    Writer.prototype.uint32 = function(value) {
      value = value >>> 0, this._reserve(5);
      var pos = this.pos;
      return this.pos = writeVarint32(value, this.buf, pos), this;
    };
    Writer.prototype.int32 = function(value) {
      return (value |= 0) < 0 ? (this._reserve(10), writeVarint64(LongBits.fromNumber(value), this.buf, this.pos), this.pos += 10, this) : this.uint32(value);
    };
    Writer.prototype.sint32 = function(value) {
      return this.uint32((value << 1 ^ value >> 31) >>> 0);
    };
    function writeVarint64(val, buf, pos) {
      for (var lo = val.lo, hi = val.hi; hi; )
        buf[pos++] = lo & 127 | 128, lo = (lo >>> 7 | hi << 25) >>> 0, hi >>>= 7;
      for (; lo > 127; )
        buf[pos++] = lo & 127 | 128, lo = lo >>> 7;
      return buf[pos] = lo, pos + 1;
    }
    Writer.prototype.uint64 = function(value) {
      var bits = LongBits.from(value);
      this._reserve(10);
      var pos = this.pos;
      return this.pos = writeVarint64(bits, this.buf, pos), this;
    };
    Writer.prototype.int64 = Writer.prototype.uint64;
    Writer.prototype.sint64 = function(value) {
      var bits = LongBits.from(value).zzEncode();
      this._reserve(10);
      var pos = this.pos;
      return this.pos = writeVarint64(bits, this.buf, pos), this;
    };
    Writer.prototype.bool = function(value) {
      return this._reserve(1), this.buf[this.pos++] = value ? 1 : 0, this;
    };
    function writeFixed32(val, buf, pos) {
      buf[pos] = val & 255, buf[pos + 1] = val >>> 8 & 255, buf[pos + 2] = val >>> 16 & 255, buf[pos + 3] = val >>> 24;
    }
    Writer.prototype.fixed32 = function(value) {
      return this._reserve(4), writeFixed32(value >>> 0, this.buf, this.pos), this.pos += 4, this;
    };
    Writer.prototype.sfixed32 = Writer.prototype.fixed32;
    Writer.prototype.fixed64 = function(value) {
      var bits = LongBits.from(value);
      return this._reserve(8), writeFixed32(bits.lo, this.buf, this.pos), writeFixed32(bits.hi, this.buf, this.pos + 4), this.pos += 8, this;
    };
    Writer.prototype.sfixed64 = Writer.prototype.fixed64;
    Writer.prototype.float = function(value) {
      return this._reserve(4), util2.float.writeFloatLE(value, this.buf, this.pos), this.pos += 4, this;
    };
    Writer.prototype.double = function(value) {
      return this._reserve(8), util2.float.writeDoubleLE(value, this.buf, this.pos), this.pos += 8, this;
    };
    Writer.prototype.bytes = function(value) {
      var len = value.length >>> 0;
      if (!len)
        return this._reserve(1), this.buf[this.pos++] = 0, this;
      if (util2.isString(value)) {
        var buf = Writer.alloc(len = base64.length(value));
        base64.decode(value, buf, 0), value = buf;
      }
      return this.uint32(len), this._reserve(len), this.buf.set(value, this.pos), this.pos += len, this;
    };
    Writer.prototype.raw = function(value) {
      var len = value.length >>> 0;
      return len ? (this._reserve(len), this.buf.set(value, this.pos), this.pos += len, this) : this;
    };
    Writer.prototype._delim = function(pos, len) {
      var n = sizeVarint32(len);
      return n > 1 && this.buf.copyWithin(pos + n, pos + 1, pos + 1 + len), writeVarint32(len, this.buf, pos), this.pos = pos + n + len, this;
    };
    Writer.prototype.string = function(value) {
      var n = value.length;
      if (!n)
        return this._reserve(1), this.buf[this.pos++] = 0, this;
      if (n < 128) {
        this._reserve(n * 3 + 5);
        var lenPos = this.pos;
        return this._delim(lenPos, utf8.write(value, this.buf, lenPos + 1));
      }
      var len = utf8.length(value);
      return this.uint32(len), this._reserve(len), len === value.length ? writeStringAscii(value, this.buf, this.pos) : utf8.write(value, this.buf, this.pos), this.pos += len, this;
    };
    Writer.prototype.uint32s = function(value) {
      var n = value.length;
      this._reserve(n * 5 + 5);
      for (var buf = this.buf, lenPos = this.pos, p = lenPos + 1, i = 0; i < n; ++i)
        p = writeVarint32(value[i] >>> 0, buf, p);
      return this._delim(lenPos, p - lenPos - 1);
    };
    Writer.prototype.int32s = function(value) {
      var n = value.length;
      this._reserve(n * 10 + 5);
      for (var buf = this.buf, lenPos = this.pos, pos = lenPos + 1, val, i = 0; i < n; ++i)
        (val = value[i] | 0) < 0 ? pos = writeVarint64(LongBits.fromNumber(val), buf, pos) : pos = writeVarint32(val, buf, pos);
      return this._delim(lenPos, pos - lenPos - 1);
    };
    Writer.prototype.sint32s = function(value) {
      var n = value.length;
      this._reserve(n * 5 + 5);
      for (var buf = this.buf, lenPos = this.pos, pos = lenPos + 1, i = 0; i < n; ++i)
        pos = writeVarint32((value[i] << 1 ^ value[i] >> 31) >>> 0, buf, pos);
      return this._delim(lenPos, pos - lenPos - 1);
    };
    Writer.prototype.uint64s = function(value) {
      var n = value.length;
      this._reserve(n * 10 + 5);
      for (var buf = this.buf, lenPos = this.pos, pos = lenPos + 1, i = 0; i < n; ++i)
        pos = writeVarint64(LongBits.from(value[i]), buf, pos);
      return this._delim(lenPos, pos - lenPos - 1);
    };
    Writer.prototype.int64s = Writer.prototype.uint64s;
    Writer.prototype.sint64s = function(value) {
      var n = value.length;
      this._reserve(n * 10 + 5);
      for (var buf = this.buf, lenPos = this.pos, pos = lenPos + 1, i = 0; i < n; ++i)
        pos = writeVarint64(LongBits.from(value[i]).zzEncode(), buf, pos);
      return this._delim(lenPos, pos - lenPos - 1);
    };
    Writer.prototype.bools = function(value) {
      var n = value.length;
      this.uint32(n), this._reserve(n);
      for (var buf = this.buf, p = this.pos, i = 0; i < n; ++i)
        buf[p++] = value[i] ? 1 : 0;
      return this.pos += n, this;
    };
    var VIEW_THRESHOLD_FLOAT = 16, VIEW_THRESHOLD_INT = 128;
    function getLazyView(writer, count, threshold) {
      var view = writer.view;
      if (view || count < threshold)
        return view;
      var buf = writer.buf;
      return writer.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    Writer.prototype.fixed32s = function(value) {
      var n = value.length, bytes = n * 4;
      this.uint32(bytes), this._reserve(bytes);
      var p = this.pos, i, dv = getLazyView(this, n, VIEW_THRESHOLD_INT);
      if (dv)
        for (i = 0; i < n; ++i)
          dv.setUint32(p, value[i] >>> 0, !0), p += 4;
      else {
        var buf = this.buf;
        for (i = 0; i < n; ++i)
          writeFixed32(value[i] >>> 0, buf, p), p += 4;
      }
      return this.pos += bytes, this;
    };
    Writer.prototype.sfixed32s = Writer.prototype.fixed32s;
    Writer.prototype.fixed64s = function(value) {
      var n = value.length, bytes = n * 8;
      this.uint32(bytes), this._reserve(bytes);
      var p = this.pos, i, bits, dv = getLazyView(this, n, VIEW_THRESHOLD_INT);
      if (dv)
        for (i = 0; i < n; ++i)
          bits = LongBits.from(value[i]), dv.setUint32(p, bits.lo, !0), dv.setUint32(p + 4, bits.hi, !0), p += 8;
      else {
        var buf = this.buf;
        for (i = 0; i < n; ++i)
          bits = LongBits.from(value[i]), writeFixed32(bits.lo, buf, p), writeFixed32(bits.hi, buf, p + 4), p += 8;
      }
      return this.pos += bytes, this;
    };
    Writer.prototype.sfixed64s = Writer.prototype.fixed64s;
    Writer.prototype.floats = function(value) {
      var n = value.length, bytes = n * 4;
      this.uint32(bytes), this._reserve(bytes);
      var p = this.pos, i, dv = getLazyView(this, n, VIEW_THRESHOLD_FLOAT);
      if (dv)
        for (i = 0; i < n; ++i)
          dv.setFloat32(p, value[i], !0), p += 4;
      else {
        var buf = this.buf;
        for (i = 0; i < n; ++i)
          util2.float.writeFloatLE(value[i], buf, p), p += 4;
      }
      return this.pos += bytes, this;
    };
    Writer.prototype.doubles = function(value) {
      var n = value.length, bytes = n * 8;
      this.uint32(bytes), this._reserve(bytes);
      var p = this.pos, i, dv = getLazyView(this, n, VIEW_THRESHOLD_FLOAT);
      if (dv)
        for (i = 0; i < n; ++i)
          dv.setFloat64(p, value[i], !0), p += 8;
      else {
        var buf = this.buf;
        for (i = 0; i < n; ++i)
          util2.float.writeDoubleLE(value[i], buf, p), p += 8;
      }
      return this.pos += bytes, this;
    };
    Writer.prototype.fork = function() {
      return this._reserve(1), (this.states || (this.states = [])).push(this.pos), this.pos += 1, this;
    };
    Writer.prototype.reset = function() {
      var states = this.states;
      return states && states.length ? this.pos = states.pop() : this.pos = 0, this;
    };
    Writer.prototype.ldelim = function() {
      var states = this.states, len, vlen;
      if (states && states.length) {
        var lenPos = states.pop();
        len = this.pos - lenPos - 1, vlen = sizeVarint32(len), vlen > 1 ? (this._reserve(vlen - 1), this.buf.copyWithin(lenPos + vlen, lenPos + 1, lenPos + 1 + len), this.pos += vlen - 1, writeVarint32(len, this.buf, lenPos)) : this.buf[lenPos] = len;
      } else
        len = this.pos, vlen = sizeVarint32(len), this._reserve(vlen), this.buf.copyWithin(vlen, 0, len), writeVarint32(len, this.buf, 0), this.pos += vlen;
      return this;
    };
    Writer.prototype.finish = function(shared) {
      if (shared)
        return this.buf.subarray(0, this.pos);
      var buf = this.constructor.alloc(this.pos);
      return buf.set(this.buf.subarray(0, this.pos), 0), buf;
    };
    Writer.prototype.finishInto = function(buf, offset) {
      return offset === void 0 && (offset = 0), buf.set(this.buf.subarray(0, this.pos), offset), buf;
    };
    Writer._configure = function(BufferWriter_) {
      BufferWriter = BufferWriter_, Writer.create = create4(), BufferWriter._configure();
    };
  }
});

// javascript/node_modules/protobufjs/src/writer_buffer.js
var require_writer_buffer = __commonJS({
  "javascript/node_modules/protobufjs/src/writer_buffer.js"(exports, module) {
    "use strict";
    module.exports = BufferWriter;
    var Writer = require_writer();
    BufferWriter.prototype = Object.create(Writer.prototype, {
      constructor: {
        value: BufferWriter,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    var util2 = require_minimal();
    function BufferWriter() {
      Writer.call(this);
    }
    var writeStringBuffer;
    BufferWriter._configure = function() {
      BufferWriter.alloc = util2.Buffer && util2.Buffer.allocUnsafe, writeStringBuffer = util2.Buffer && util2.Buffer.prototype.utf8Write ? function(val, buf, pos) {
        return buf.utf8Write(val, pos);
      } : function(val, buf, pos) {
        return buf.write(val, pos);
      };
    };
    BufferWriter.prototype.bytes = function(value) {
      util2.isString(value) && (value = util2.Buffer.from(value, "base64"));
      var len = value.length >>> 0;
      return this.uint32(len), len && (this._reserve(len), this.buf.set(value, this.pos), this.pos += len), this;
    };
    BufferWriter.prototype.string = function(value) {
      var n = value.length;
      if (!n)
        return this._reserve(1), this.buf[this.pos++] = 0, this;
      if (n < 128) {
        this._reserve(n * 3 + 5);
        var pos = this.pos, buf = this.buf;
        return this._delim(
          pos,
          n < 40 ? util2.utf8.write(value, buf, pos + 1) : writeStringBuffer(value, buf, pos + 1)
        );
      }
      var len = util2.Buffer.byteLength(value);
      return this.uint32(len), this._reserve(len), writeStringBuffer(value, this.buf, this.pos), this.pos += len, this;
    };
    BufferWriter._configure();
  }
});

// javascript/node_modules/protobufjs/src/reader.js
var require_reader = __commonJS({
  "javascript/node_modules/protobufjs/src/reader.js"(exports, module) {
    "use strict";
    module.exports = Reader;
    var util2 = require_minimal(), BufferReader, LongBits = util2.LongBits, utf8 = util2.utf8;
    function indexOutOfRange(reader, writeLength) {
      return RangeError("index out of range: " + reader.pos + " + " + (writeLength || 1) + " > " + reader.len);
    }
    function Reader(buffer) {
      this.buf = buffer, this.pos = 0, this.len = buffer.length, this.view = null, this.discardUnknown = Reader.discardUnknown;
    }
    function create_array(buffer) {
      if (Array.isArray(buffer) && (buffer = new Uint8Array(buffer)), buffer instanceof Uint8Array)
        return new Reader(buffer);
      throw Error("illegal buffer");
    }
    var create4 = function() {
      return util2.Buffer ? function(buffer) {
        return (Reader.create = function(buffer2) {
          return util2.Buffer.isBuffer(buffer2) ? new BufferReader(buffer2) : create_array(buffer2);
        })(buffer);
      } : create_array;
    };
    Reader.create = create4();
    Reader.prototype.raw = function(start, end) {
      return this.buf.subarray(start, end);
    };
    function readVarint32NearEnd(reader) {
      for (var value = 0, i = 0; i < 4; ++i) {
        if (reader.pos >= reader.len)
          throw indexOutOfRange(reader);
        var b = reader.buf[reader.pos++];
        if (value = (value | (b & 127) << i * 7) >>> 0, b < 128)
          return value;
      }
      throw indexOutOfRange(reader);
    }
    Reader.prototype.uint32 = function() {
      if (this.len - this.pos < 5) {
        if (this.pos >= this.len)
          throw indexOutOfRange(this);
        if (this.buf[this.pos] >= 128)
          return readVarint32NearEnd(this);
      }
      var buf = this.buf, pos = this.pos, value = (buf[pos] & 127) >>> 0;
      if (buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 127) << 7) >>> 0, buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 127) << 14) >>> 0, buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 127) << 21) >>> 0, buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 15) << 28) >>> 0, buf[pos++] < 128)
        return this.pos = pos, value;
      for (var i = 0; i < 5; ++i) {
        if (pos >= this.len)
          throw this.pos = pos, indexOutOfRange(this);
        if (buf[pos++] < 128)
          return this.pos = pos, value;
      }
      throw this.pos = pos, Error("invalid varint encoding");
    };
    Reader.prototype.tag = function() {
      if (this.len - this.pos < 5) {
        if (this.pos >= this.len)
          throw indexOutOfRange(this);
        if (this.buf[this.pos] >= 128)
          return readVarint32NearEnd(this);
      }
      var buf = this.buf, pos = this.pos, value = (buf[pos] & 127) >>> 0;
      if (buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 127) << 7) >>> 0, buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 127) << 14) >>> 0, buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 127) << 21) >>> 0, buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 15) << 28) >>> 0, buf[pos] < 128 && (buf[pos] & 112) === 0)
        return this.pos = pos + 1, value;
      throw this.pos = pos + 1, Error("invalid tag encoding");
    };
    Reader.prototype.int32 = function() {
      return this.uint32() | 0;
    };
    Reader.prototype.sint32 = function() {
      var value = this.uint32();
      return value >>> 1 ^ -(value & 1) | 0;
    };
    function readLongVarint() {
      var bits = new LongBits(0, 0), i = 0;
      if (this.len - this.pos > 4) {
        for (; i < 4; ++i)
          if (bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0, this.buf[this.pos++] < 128)
            return bits;
        if (bits.lo = (bits.lo | (this.buf[this.pos] & 127) << 28) >>> 0, bits.hi = (bits.hi | (this.buf[this.pos] & 127) >> 4) >>> 0, this.buf[this.pos++] < 128)
          return bits;
        i = 0;
      } else {
        for (; i < 4; ++i) {
          if (this.pos >= this.len)
            throw indexOutOfRange(this);
          if (bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0, this.buf[this.pos++] < 128)
            return bits;
        }
        throw indexOutOfRange(this);
      }
      if (this.len - this.pos > 4) {
        for (; i < 5; ++i)
          if (bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0, this.buf[this.pos++] < 128)
            return bits;
      } else
        for (; i < 5; ++i) {
          if (this.pos >= this.len)
            throw indexOutOfRange(this);
          if (bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0, this.buf[this.pos++] < 128)
            return bits;
        }
      throw Error("invalid varint encoding");
    }
    Reader.prototype.bool = function() {
      for (var value = !1, b, i = 0; i < 10; ++i) {
        if (this.pos >= this.len)
          throw indexOutOfRange(this);
        if (b = this.buf[this.pos++], b & 127 && (value = !0), b < 128)
          return value;
      }
      throw Error("invalid varint encoding");
    };
    function readFixed32_end(buf, end) {
      return (buf[end - 4] | buf[end - 3] << 8 | buf[end - 2] << 16 | buf[end - 1] << 24) >>> 0;
    }
    Reader.prototype.fixed32 = function() {
      if (this.pos + 4 > this.len)
        throw indexOutOfRange(this, 4);
      return readFixed32_end(this.buf, this.pos += 4);
    };
    Reader.prototype.sfixed32 = function() {
      if (this.pos + 4 > this.len)
        throw indexOutOfRange(this, 4);
      return readFixed32_end(this.buf, this.pos += 4) | 0;
    };
    function readFixed64() {
      if (this.pos + 8 > this.len)
        throw indexOutOfRange(this, 8);
      return new LongBits(readFixed32_end(this.buf, this.pos += 4), readFixed32_end(this.buf, this.pos += 4));
    }
    Reader.prototype.float = function() {
      if (this.pos + 4 > this.len)
        throw indexOutOfRange(this, 4);
      var value = util2.float.readFloatLE(this.buf, this.pos);
      return this.pos += 4, value;
    };
    Reader.prototype.double = function() {
      if (this.pos + 8 > this.len)
        throw indexOutOfRange(this, 4);
      var value = util2.float.readDoubleLE(this.buf, this.pos);
      return this.pos += 8, value;
    };
    Reader.prototype.uint32s = function(array) {
      array === void 0 && (array = []);
      var end = this.uint32() + this.pos, len = this.len, buf = this.buf, pos = this.pos, value;
      if (end > len) throw indexOutOfRange(this, end - this.pos);
      for (this.len = end; pos < end; )
        value = buf[pos++], value < 128 ? array.push(value) : (this.pos = pos - 1, array.push(this.uint32()), pos = this.pos);
      if (this.pos = pos, pos !== end) throw RangeError("index out of range");
      return this.len = len, array;
    };
    Reader.prototype.int32s = function(array) {
      array === void 0 && (array = []);
      var end = this.uint32() + this.pos, len = this.len, buf = this.buf, pos = this.pos, value;
      if (end > len) throw indexOutOfRange(this, end - this.pos);
      for (this.len = end; pos < end; )
        value = buf[pos++], value < 128 ? array.push(value) : (this.pos = pos - 1, array.push(this.int32()), pos = this.pos);
      if (this.pos = pos, pos !== end) throw RangeError("index out of range");
      return this.len = len, array;
    };
    Reader.prototype.sint32s = function(array) {
      array === void 0 && (array = []);
      var end = this.uint32() + this.pos, len = this.len;
      if (end > len) throw indexOutOfRange(this, end - this.pos);
      for (this.len = end; this.pos < end; )
        array.push(this.sint32());
      if (this.pos !== end) throw RangeError("index out of range");
      return this.len = len, array;
    };
    Reader.prototype.bools = function(array) {
      array === void 0 && (array = []);
      var end = this.uint32() + this.pos, len = this.len, buf = this.buf, pos = this.pos, value;
      if (end > len) throw indexOutOfRange(this, end - this.pos);
      for (this.len = end; pos < end; )
        value = buf[pos++], value < 128 ? array.push(value !== 0) : (this.pos = pos - 1, array.push(this.bool()), pos = this.pos);
      if (this.pos = pos, pos !== end) throw RangeError("index out of range");
      return this.len = len, array;
    };
    var VIEW_THRESHOLD_FLOAT = 8, VIEW_THRESHOLD_INT = 128;
    function getLazyView(reader, count, threshold) {
      var view = reader.view;
      if (view || count < threshold)
        return view;
      var buf = reader.buf;
      return reader.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    Reader.prototype.fixed32s = function(array) {
      array === void 0 && (array = []);
      var len = this.uint32(), end = this.pos + len;
      if (end > this.len) throw indexOutOfRange(this, len);
      var count = len >>> 2, i = array.length, pos = this.pos;
      array.length = i + count;
      var dv = getLazyView(this, count, VIEW_THRESHOLD_INT);
      if (dv)
        for (var k = 0; k < count; ++k, pos += 4) array[i++] = dv.getUint32(pos, !0);
      else
        for (var buf = this.buf, j = 0; j < count; ++j, pos += 4) array[i++] = readFixed32_end(buf, pos + 4);
      if (this.pos = pos, pos !== end) throw indexOutOfRange(this, 4);
      return array;
    };
    Reader.prototype.sfixed32s = function(array) {
      array === void 0 && (array = []);
      var len = this.uint32(), end = this.pos + len;
      if (end > this.len) throw indexOutOfRange(this, len);
      var count = len >>> 2, i = array.length, pos = this.pos;
      array.length = i + count;
      var dv = getLazyView(this, count, VIEW_THRESHOLD_INT);
      if (dv)
        for (var k = 0; k < count; ++k, pos += 4) array[i++] = dv.getInt32(pos, !0);
      else
        for (var buf = this.buf, j = 0; j < count; ++j, pos += 4) array[i++] = readFixed32_end(buf, pos + 4) | 0;
      if (this.pos = pos, pos !== end) throw indexOutOfRange(this, 4);
      return array;
    };
    Reader.prototype.floats = function(array) {
      array === void 0 && (array = []);
      var len = this.uint32(), end = this.pos + len;
      if (end > this.len) throw indexOutOfRange(this, len);
      var count = len >>> 2, i = array.length, pos = this.pos;
      array.length = i + count;
      var dv = getLazyView(this, count, VIEW_THRESHOLD_FLOAT);
      if (dv)
        for (var k = 0; k < count; ++k, pos += 4) array[i++] = dv.getFloat32(pos, !0);
      else
        for (var buf = this.buf, j = 0; j < count; ++j, pos += 4) array[i++] = util2.float.readFloatLE(buf, pos);
      if (this.pos = pos, pos !== end) throw indexOutOfRange(this, 4);
      return array;
    };
    Reader.prototype.doubles = function(array) {
      array === void 0 && (array = []);
      var len = this.uint32(), end = this.pos + len;
      if (end > this.len) throw indexOutOfRange(this, len);
      var count = len >>> 3, i = array.length, pos = this.pos;
      array.length = i + count;
      var dv = getLazyView(this, count, VIEW_THRESHOLD_FLOAT);
      if (dv)
        for (var k = 0; k < count; ++k, pos += 8) array[i++] = dv.getFloat64(pos, !0);
      else
        for (var buf = this.buf, j = 0; j < count; ++j, pos += 8) array[i++] = util2.float.readDoubleLE(buf, pos);
      if (this.pos = pos, pos !== end) throw indexOutOfRange(this, 8);
      return array;
    };
    Reader.prototype.uint64s = function(array) {
      array === void 0 && (array = []);
      var end = this.uint32() + this.pos, len = this.len;
      if (end > len) throw indexOutOfRange(this, end - this.pos);
      for (this.len = end; this.pos < end; )
        array.push(this.uint64());
      if (this.pos !== end) throw RangeError("index out of range");
      return this.len = len, array;
    };
    Reader.prototype.int64s = function(array) {
      array === void 0 && (array = []);
      var end = this.uint32() + this.pos, len = this.len;
      if (end > len) throw indexOutOfRange(this, end - this.pos);
      for (this.len = end; this.pos < end; )
        array.push(this.int64());
      if (this.pos !== end) throw RangeError("index out of range");
      return this.len = len, array;
    };
    Reader.prototype.sint64s = function(array) {
      array === void 0 && (array = []);
      var end = this.uint32() + this.pos, len = this.len;
      if (end > len) throw indexOutOfRange(this, end - this.pos);
      for (this.len = end; this.pos < end; )
        array.push(this.sint64());
      if (this.pos !== end) throw RangeError("index out of range");
      return this.len = len, array;
    };
    Reader.prototype.fixed64s = function(array) {
      array === void 0 && (array = []);
      var len = this.uint32(), end = this.pos + len, i = array.length;
      if (end > this.len) throw indexOutOfRange(this, len);
      var count = len >>> 3;
      array.length = i + count;
      for (var j = 0; j < count; ++j)
        array[i++] = this.fixed64();
      if (this.pos !== end) throw indexOutOfRange(this, 8);
      return array;
    };
    Reader.prototype.sfixed64s = function(array) {
      array === void 0 && (array = []);
      var len = this.uint32(), end = this.pos + len, i = array.length;
      if (end > this.len) throw indexOutOfRange(this, len);
      var count = len >>> 3;
      array.length = i + count;
      for (var j = 0; j < count; ++j)
        array[i++] = this.sfixed64();
      if (this.pos !== end) throw indexOutOfRange(this, 8);
      return array;
    };
    Reader.prototype.bytes = function() {
      var length = this.uint32(), start = this.pos, end = this.pos + length;
      if (end > this.len)
        throw indexOutOfRange(this, length);
      return this.pos = end, this.raw(start, end);
    };
    Reader.prototype.string = function() {
      var length = this.uint32(), start = this.pos, end = this.pos + length;
      if (end > this.len)
        throw indexOutOfRange(this, length);
      return this.pos = end, utf8.read(this.buf, start, end);
    };
    Reader.prototype.stringVerify = function() {
      var length = this.uint32(), start = this.pos, end = this.pos + length;
      if (end > this.len)
        throw indexOutOfRange(this, length);
      return this.pos = end, utf8.readStrict(this.buf, start, end);
    };
    Reader.prototype.skip = function(length) {
      if (typeof length == "number") {
        if (this.pos + length > this.len)
          throw indexOutOfRange(this, length);
        this.pos += length;
      } else
        do
          if (this.pos >= this.len)
            throw indexOutOfRange(this);
        while (this.buf[this.pos++] & 128);
      return this;
    };
    Reader.recursionLimit = util2.recursionLimit;
    Reader.discardUnknown = !0;
    Reader.prototype.skipType = function(wireType, depth, fieldNumber) {
      if (depth === void 0 && (depth = 0), depth > Reader.recursionLimit)
        throw Error("max depth exceeded");
      if (fieldNumber === 0)
        throw Error("illegal tag: field number 0");
      switch (wireType) {
        case 0:
          this.skip();
          break;
        case 1:
          this.skip(8);
          break;
        case 2:
          this.skip(this.uint32());
          break;
        case 3:
          for (; ; ) {
            var tag = this.tag(), nestedField = tag >>> 3;
            if (wireType = tag & 7, !nestedField)
              throw Error("illegal tag: field number 0");
            if (wireType === 4) {
              if (fieldNumber !== void 0 && nestedField !== fieldNumber)
                throw Error("invalid end group tag");
              break;
            }
            this.skipType(wireType, depth + 1, nestedField);
          }
          break;
        case 5:
          this.skip(4);
          break;
        /* istanbul ignore next */
        default:
          throw Error("invalid wire type " + wireType + " at offset " + this.pos);
      }
      return this;
    };
    Reader._configure = function(BufferReader_) {
      BufferReader = BufferReader_, Reader.create = create4(), BufferReader._configure();
      var fn = util2.Long ? "toLong" : (
        /* istanbul ignore next */
        "toNumber"
      );
      util2.merge(Reader.prototype, {
        int64: function() {
          return readLongVarint.call(this)[fn](!1);
        },
        uint64: function() {
          return readLongVarint.call(this)[fn](!0);
        },
        sint64: function() {
          return readLongVarint.call(this).zzDecode()[fn](!1);
        },
        fixed64: function() {
          return readFixed64.call(this)[fn](!0);
        },
        sfixed64: function() {
          return readFixed64.call(this)[fn](!1);
        }
      });
    };
  }
});

// javascript/node_modules/protobufjs/src/reader_buffer.js
var require_reader_buffer = __commonJS({
  "javascript/node_modules/protobufjs/src/reader_buffer.js"(exports, module) {
    "use strict";
    module.exports = BufferReader;
    var Reader = require_reader();
    BufferReader.prototype = Object.create(Reader.prototype, {
      constructor: {
        value: BufferReader,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    var util2 = require_minimal();
    function BufferReader(buffer) {
      Reader.call(this, buffer);
    }
    BufferReader._configure = function() {
      util2.Buffer && (BufferReader.prototype._slice = util2.Buffer.prototype.slice);
    };
    BufferReader.prototype.raw = function(start, end) {
      return this._slice.call(this.buf, start, end);
    };
    BufferReader.prototype.string = function() {
      var len = this.uint32(), start = this.pos, end = this.pos + len;
      if (end > this.len)
        throw RangeError("index out of range: " + this.pos + " + " + len + " > " + this.len);
      return this.pos = end, this.buf.utf8Slice ? this.buf.utf8Slice(start, end) : this.buf.toString("utf-8", start, end);
    };
    BufferReader._configure();
  }
});

// javascript/node_modules/protobufjs/src/rpc/service.js
var require_service2 = __commonJS({
  "javascript/node_modules/protobufjs/src/rpc/service.js"(exports, module) {
    "use strict";
    module.exports = Service;
    var util2 = require_minimal();
    Service.prototype = Object.create(util2.EventEmitter.prototype, {
      constructor: {
        value: Service,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    function Service(rpcImpl, requestDelimited, responseDelimited) {
      if (typeof rpcImpl != "function")
        throw TypeError("rpcImpl must be a function");
      util2.EventEmitter.call(this), this.rpcImpl = rpcImpl, this.requestDelimited = !!requestDelimited, this.responseDelimited = !!responseDelimited;
    }
    Service.prototype.rpcCall = function rpcCall(method, requestCtor, responseCtor, request, callback) {
      if (!request)
        throw TypeError("request must be specified");
      var self2 = this;
      if (!callback)
        return util2.asPromise(rpcCall, self2, method, requestCtor, responseCtor, request);
      if (!self2.rpcImpl) {
        setTimeout(function() {
          callback(Error("already ended"));
        }, 0);
        return;
      }
      try {
        return self2.rpcImpl(
          method,
          requestCtor[self2.requestDelimited ? "encodeDelimited" : "encode"](request).finish(),
          function(err, response) {
            if (err)
              return self2.emit("error", err, method), callback(err);
            if (response === null) {
              self2.end(
                /* endedByRPC */
                !0
              );
              return;
            }
            if (!(response instanceof responseCtor))
              try {
                response = responseCtor[self2.responseDelimited ? "decodeDelimited" : "decode"](response);
              } catch (err2) {
                return self2.emit("error", err2, method), callback(err2);
              }
            return self2.emit("data", response, method), callback(null, response);
          }
        );
      } catch (err) {
        self2.emit("error", err, method), setTimeout(function() {
          callback(err);
        }, 0);
        return;
      }
    };
    Service.prototype.end = function(endedByRPC) {
      return this.rpcImpl && (endedByRPC || this.rpcImpl(null, null, null), this.rpcImpl = null, this.emit("end").off()), this;
    };
  }
});

// javascript/node_modules/protobufjs/src/rpc.js
var require_rpc = __commonJS({
  "javascript/node_modules/protobufjs/src/rpc.js"(exports) {
    "use strict";
    var rpc = exports;
    rpc.Service = require_service2();
  }
});

// javascript/node_modules/protobufjs/src/roots.js
var require_roots = __commonJS({
  "javascript/node_modules/protobufjs/src/roots.js"(exports, module) {
    "use strict";
    module.exports = /* @__PURE__ */ Object.create(null);
  }
});

// javascript/node_modules/protobufjs/src/index-minimal.js
var require_index_minimal = __commonJS({
  "javascript/node_modules/protobufjs/src/index-minimal.js"(exports) {
    "use strict";
    exports.build = "minimal";
    exports.Writer = require_writer();
    exports.BufferWriter = require_writer_buffer();
    exports.Reader = require_reader();
    exports.BufferReader = require_reader_buffer();
    exports.util = require_minimal();
    exports.rpc = require_rpc();
    exports.roots = require_roots();
    exports.configure = configure2;
    function configure2() {
      exports.util.LongBits._configure(exports.util.Long), exports.Writer._configure(exports.BufferWriter), exports.Reader._configure(exports.BufferReader);
    }
    configure2();
  }
});

// javascript/node_modules/protobufjs/src/util/patterns.js
var require_patterns = __commonJS({
  "javascript/node_modules/protobufjs/src/util/patterns.js"(exports) {
    "use strict";
    var patterns = exports;
    patterns.numberRe = /^(?![eE])[0-9]*(?:\.[0-9]*)?(?:[eE][+-]?[0-9]+)?$/;
    patterns.typeRefRe = /^(?:\.?[a-zA-Z_][a-zA-Z_0-9]*)(?:\.[a-zA-Z_][a-zA-Z_0-9]*)*$/;
    patterns.reservedRe = /^(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$/;
  }
});

// javascript/node_modules/protobufjs/src/util/codegen.js
var require_codegen = __commonJS({
  "javascript/node_modules/protobufjs/src/util/codegen.js"(exports, module) {
    "use strict";
    module.exports = codegen;
    var patterns = require_patterns(), reservedRe = patterns.reservedRe;
    function codegen(functionParams, functionName) {
      typeof functionParams == "string" && (functionName = functionParams, functionParams = void 0);
      var body = [];
      function Codegen(formatStringOrScope) {
        if (typeof formatStringOrScope != "string") {
          var source = toString2();
          if (codegen.verbose && console.log("codegen: " + source), source = "return " + source, formatStringOrScope) {
            for (var scopeKeys = Object.keys(formatStringOrScope), scopeParams = new Array(scopeKeys.length + 1), scopeValues = new Array(scopeKeys.length), scopeOffset = 0; scopeOffset < scopeKeys.length; )
              scopeParams[scopeOffset] = scopeKeys[scopeOffset], scopeValues[scopeOffset] = formatStringOrScope[scopeKeys[scopeOffset++]];
            return scopeParams[scopeOffset] = source, Function.apply(null, scopeParams).apply(null, scopeValues);
          }
          return Function(source)();
        }
        for (var formatParams = new Array(arguments.length - 1), formatOffset = 0; formatOffset < formatParams.length; )
          formatParams[formatOffset] = arguments[++formatOffset];
        if (formatOffset = 0, formatStringOrScope = formatStringOrScope.replace(/%([%dfijs])/g, function($0, $1) {
          var value = formatParams[formatOffset++];
          switch ($1) {
            case "d":
            case "f":
              return value = Number(value), Object.is(value, -0) ? "-0" : String(value);
            case "i":
              return String(Math.floor(value));
            case "j":
              return JSON.stringify(value);
            case "s":
              return String(value);
          }
          return "%";
        }), formatOffset !== formatParams.length)
          throw Error("parameter count mismatch");
        return body.push(formatStringOrScope), Codegen;
      }
      function toString2(functionNameOverride) {
        return "function " + safeFunctionName(functionNameOverride || functionName) + "(" + (functionParams && functionParams.join(",") || "") + `){
  ` + body.join(`
  `) + `
}`;
      }
      return Object.defineProperty(Codegen, "toString", {
        value: toString2,
        writable: !0,
        enumerable: !0,
        configurable: !0
      }), Codegen;
    }
    codegen.verbose = !1;
    function safeFunctionName(name) {
      return !name || (name = String(name).replace(/[^\w$]/g, ""), !name) ? "" : (/^\d/.test(name) && (name = "_" + name), reservedRe.test(name) ? name + "_" : name);
    }
  }
});

// (disabled):fs
var require_fs = __commonJS({
  "(disabled):fs"() {
  }
});

// javascript/node_modules/protobufjs/src/util/fs.js
var require_fs2 = __commonJS({
  "javascript/node_modules/protobufjs/src/util/fs.js"(exports, module) {
    "use strict";
    var fs = null;
    try {
      fs = require_fs(), (!fs || !fs.readFile || !fs.readFileSync) && (fs = null);
    } catch {
    }
    module.exports = fs;
  }
});

// javascript/node_modules/protobufjs/src/util/fetch.js
var require_fetch = __commonJS({
  "javascript/node_modules/protobufjs/src/util/fetch.js"(exports, module) {
    "use strict";
    module.exports = fetch2;
    var asPromise = require_aspromise(), fs = require_fs2();
    function fetch2(filename, options, callback) {
      return typeof options == "function" ? (callback = options, options = {}) : options || (options = {}), callback ? !options.xhr && fs && fs.readFile ? fs.readFile(filename, function(err, contents) {
        return err && typeof XMLHttpRequest < "u" ? fetch2.xhr(filename, options, callback) : err ? callback(err) : callback(null, options.binary ? contents : contents.toString("utf8"));
      }) : fetch2.xhr(filename, options, callback) : asPromise(fetch2, this, filename, options);
    }
    fetch2.xhr = function(filename, options, callback) {
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status !== 0 && xhr.status !== 200)
            return callback(Error("status " + xhr.status));
          if (options.binary) {
            var buffer = xhr.response;
            if (!buffer) {
              buffer = [];
              for (var i = 0; i < xhr.responseText.length; ++i)
                buffer.push(xhr.responseText.charCodeAt(i) & 255);
            }
            return callback(null, typeof Uint8Array < "u" ? new Uint8Array(buffer) : buffer);
          }
          return callback(null, xhr.responseText);
        }
      }, options.binary && ("overrideMimeType" in xhr && xhr.overrideMimeType("text/plain; charset=x-user-defined"), xhr.responseType = "arraybuffer"), xhr.open("GET", filename), xhr.send();
    };
  }
});

// javascript/node_modules/protobufjs/src/util/path.js
var require_path = __commonJS({
  "javascript/node_modules/protobufjs/src/util/path.js"(exports) {
    "use strict";
    var path = exports, urlRe = /^[a-zA-Z][a-zA-Z0-9+.-]+:\/\//;
    function normalizeUrl(path2) {
      if (typeof URL > "u" || !urlRe.test(path2))
        return null;
      try {
        return new URL(path2).href;
      } catch {
        return null;
      }
    }
    function resolveUrl(originPath, includePath) {
      if (typeof URL > "u" || !urlRe.test(originPath) || urlRe.test(includePath))
        return null;
      try {
        return new URL(includePath, originPath).href;
      } catch {
        return null;
      }
    }
    var isAbsolute = (
      /**
       * Tests if the specified path is absolute.
       * @param {string} path Path to test
       * @returns {boolean} `true` if path is absolute
       */
      path.isAbsolute = function(path2) {
        return /^(?:\/|\w+:|\\\\\w+)/.test(path2);
      }
    ), normalize = (
      /**
       * Normalizes the specified path.
       * @param {string} path Path to normalize
       * @returns {string} Normalized path
       */
      path.normalize = function(path2) {
        var normalizedUrl = normalizeUrl(path2);
        if (normalizedUrl)
          return normalizedUrl;
        var firstTwoCharacters = path2.substring(0, 2), uncPrefix = "";
        firstTwoCharacters === "\\\\" && (uncPrefix = firstTwoCharacters, path2 = path2.substring(2)), path2 = path2.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
        var parts = path2.split("/"), absolute = isAbsolute(path2), prefix = "";
        absolute && (prefix = parts.shift() + "/");
        for (var i = 0; i < parts.length; )
          parts[i] === ".." ? i > 0 && parts[i - 1] !== ".." ? parts.splice(--i, 2) : absolute ? parts.splice(i, 1) : ++i : parts[i] === "." ? parts.splice(i, 1) : ++i;
        return uncPrefix + prefix + parts.join("/");
      }
    );
    path.resolve = function(originPath, includePath, alreadyNormalized) {
      var resolvedUrl = resolveUrl(originPath, includePath);
      return resolvedUrl || (alreadyNormalized || (includePath = normalize(includePath)), isAbsolute(includePath) ? includePath : (alreadyNormalized || (originPath = normalize(originPath)), (originPath = originPath.replace(/(?:\/|^)[^/]+$/, "")).length ? normalize(originPath + "/" + includePath) : includePath));
    };
  }
});

// javascript/node_modules/protobufjs/src/namespace.js
var require_namespace = __commonJS({
  "javascript/node_modules/protobufjs/src/namespace.js"(exports, module) {
    "use strict";
    module.exports = Namespace;
    var ReflectionObject = require_object();
    Namespace.prototype = Object.create(ReflectionObject.prototype, {
      constructor: {
        value: Namespace,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    Namespace.className = "Namespace";
    var Field = require_field(), util2 = require_util(), OneOf = require_oneof(), Type, Service, Enum;
    Namespace.fromJSON = function(name, json, depth) {
      if (depth === void 0 && (depth = 0), depth > util2.recursionLimit)
        throw Error("max depth exceeded");
      return new Namespace(name, json.options).addJSON(json.nested, depth);
    };
    function arrayToJSON(array, toJSONOptions) {
      if (array && array.length) {
        for (var obj = {}, i = 0; i < array.length; ++i)
          obj[array[i].name] = array[i].toJSON(toJSONOptions);
        return obj;
      }
    }
    Namespace.arrayToJSON = arrayToJSON;
    Namespace.isReservedId = function(reserved, id) {
      if (reserved) {
        for (var i = 0; i < reserved.length; ++i)
          if (typeof reserved[i] != "string" && reserved[i][0] <= id && reserved[i][1] >= id)
            return !0;
      }
      return !1;
    };
    Namespace.isReservedName = function(reserved, name) {
      if (reserved) {
        for (var i = 0; i < reserved.length; ++i)
          if (reserved[i] === name)
            return !0;
      }
      return !1;
    };
    function Namespace(name, options) {
      ReflectionObject.call(this, name, options), this.nested = void 0, this._nestedArray = null, this._lookupCache = /* @__PURE__ */ Object.create(null), this._needsRecursiveFeatureResolution = !0, this._needsRecursiveResolve = !0;
    }
    function clearCache(namespace) {
      namespace._nestedArray = null, namespace._lookupCache = /* @__PURE__ */ Object.create(null);
      for (var parent = namespace; parent = parent.parent; )
        parent._lookupCache = /* @__PURE__ */ Object.create(null);
      return namespace;
    }
    Object.defineProperty(Namespace.prototype, "nestedArray", {
      get: function() {
        return this._nestedArray || (this._nestedArray = util2.toArray(this.nested));
      }
    });
    Namespace.prototype.toJSON = function(toJSONOptions) {
      return util2.toObject([
        "options",
        this.options,
        "nested",
        arrayToJSON(this.nestedArray, toJSONOptions)
      ]);
    };
    Namespace.prototype.addJSON = function(nestedJson, depth) {
      if (depth === void 0 && (depth = 0), depth > util2.recursionLimit)
        throw Error("max depth exceeded");
      var ns = this;
      if (nestedJson)
        for (var names = Object.keys(nestedJson), i = 0, nested; i < names.length; ++i)
          nested = nestedJson[names[i]], ns.add(
            // most to least likely
            (nested.fields !== void 0 ? Type.fromJSON : nested.values !== void 0 ? Enum.fromJSON : nested.methods !== void 0 ? Service.fromJSON : nested.id !== void 0 ? Field.fromJSON : Namespace.fromJSON)(names[i], nested, depth + 1)
          );
      return this;
    };
    Namespace.prototype.get = function(name) {
      return this.nested && Object.prototype.hasOwnProperty.call(this.nested, name) ? this.nested[name] : null;
    };
    Namespace.prototype.getEnum = function(name) {
      if (this.nested && Object.prototype.hasOwnProperty.call(this.nested, name) && this.nested[name] instanceof Enum)
        return this.nested[name].values;
      throw Error("no such enum: " + name);
    };
    Namespace.prototype.add = function(object) {
      if (!(object instanceof Field && object.extend !== void 0 || object instanceof Type || object instanceof OneOf || object instanceof Enum || object instanceof Service || object instanceof Namespace))
        throw TypeError("object must be a valid nested object");
      if (object.name === "__proto__")
        return this;
      if (!this.nested)
        this.nested = {};
      else {
        var prev = this.get(object.name);
        if (prev)
          if (prev instanceof Namespace && object instanceof Namespace && !(prev instanceof Type || prev instanceof Service)) {
            for (var nested = prev.nestedArray, i = 0; i < nested.length; ++i)
              object.add(nested[i]);
            this.remove(prev), this.nested || (this.nested = {}), object.setOptions(prev.options, !0);
          } else
            throw Error("duplicate name '" + object.name + "' in " + this);
      }
      this.nested[object.name] = object, this instanceof Type || this instanceof Service || this instanceof Enum || this instanceof Field || object._edition || (object._edition = object._defaultEdition), this._needsRecursiveFeatureResolution = !0, this._needsRecursiveResolve = !0;
      for (var parent = this; parent = parent.parent; )
        parent._needsRecursiveFeatureResolution = !0, parent._needsRecursiveResolve = !0;
      return object.onAdd(this), clearCache(this);
    };
    Namespace.prototype.remove = function(object) {
      if (!(object instanceof ReflectionObject))
        throw TypeError("object must be a ReflectionObject");
      if (object.parent !== this)
        throw Error(object + " is not a member of " + this);
      if (!util2.remove(this.nested, object, object.name))
        throw Error(object + " is not a member of " + this);
      return Object.keys(this.nested).length || (this.nested = void 0), object.onRemove(this), clearCache(this);
    };
    Namespace.prototype.define = function(path, json) {
      if (util2.isString(path))
        path = path.split(".");
      else if (!Array.isArray(path))
        throw TypeError("illegal path");
      if (path && path.length && path[0] === "")
        throw Error("path must be relative");
      if (path.length > util2.recursionLimit)
        throw Error("max depth exceeded");
      for (var ptr = this; path.length > 0; ) {
        var part = path.shift();
        if (ptr.nested && ptr.nested[part]) {
          if (ptr = ptr.nested[part], !(ptr instanceof Namespace))
            throw Error("path conflicts with non-namespace objects");
        } else
          ptr.add(ptr = new Namespace(part));
      }
      return json && ptr.addJSON(json), ptr;
    };
    Namespace.prototype.resolveAll = function() {
      if (!this._needsRecursiveResolve) return this;
      this._needsRecursiveFeatureResolution && this._resolveFeaturesRecursive(this._edition);
      var nested = this.nestedArray, i = 0;
      for (this.resolve(); i < nested.length; )
        nested[i] instanceof Namespace ? nested[i++].resolveAll() : nested[i++].resolve();
      return this._needsRecursiveResolve = !1, this;
    };
    Namespace.prototype._resolveFeaturesRecursive = function(edition) {
      return this._needsRecursiveFeatureResolution ? (this._needsRecursiveFeatureResolution = !1, edition = this._edition || edition, ReflectionObject.prototype._resolveFeaturesRecursive.call(this, edition), this.nestedArray.forEach((nested) => {
        nested._resolveFeaturesRecursive(edition);
      }), this) : this;
    };
    Namespace.prototype.lookup = function(path, filterTypes, parentAlreadyChecked) {
      if (typeof filterTypes == "boolean" ? (parentAlreadyChecked = filterTypes, filterTypes = void 0) : filterTypes && !Array.isArray(filterTypes) && (filterTypes = [filterTypes]), util2.isString(path) && path.length) {
        if (path === ".")
          return this.root;
        path = path.split(".");
      } else if (!path.length)
        return this;
      var flatPath = path.join(".");
      if (path[0] === "")
        return this.root.lookup(path.slice(1), filterTypes);
      var found = this._lookupImpl(path, flatPath);
      if (found && (!filterTypes || filterTypes.indexOf(found.constructor) > -1) || (found = this.root._fullyQualifiedObjects && this.root._fullyQualifiedObjects["." + flatPath], found && (!filterTypes || filterTypes.indexOf(found.constructor) > -1)))
        return found;
      if (parentAlreadyChecked)
        return null;
      for (var current = this; current.parent; ) {
        if (found = current.parent._lookupImpl(path, flatPath), found && (!filterTypes || filterTypes.indexOf(found.constructor) > -1))
          return found;
        current = current.parent;
      }
      return null;
    };
    Namespace.prototype._lookupImpl = function(path, flatPath) {
      if (Object.prototype.hasOwnProperty.call(this._lookupCache, flatPath))
        return this._lookupCache[flatPath];
      var found = this.get(path[0]), exact = null;
      if (found)
        path.length === 1 ? exact = found : found instanceof Namespace && (path = path.slice(1), exact = found._lookupImpl(path, path.join(".")));
      else
        for (var i = 0; i < this.nestedArray.length; ++i)
          if (this._nestedArray[i] instanceof Namespace && (found = this._nestedArray[i]._lookupImpl(path, flatPath))) {
            exact = found;
            break;
          }
      return this._lookupCache[flatPath] = exact, exact;
    };
    Namespace.prototype.lookupType = function(path) {
      var found = this.lookup(path, [Type]);
      if (!found)
        throw Error("no such type: " + path);
      return found;
    };
    Namespace.prototype.lookupEnum = function(path) {
      var found = this.lookup(path, [Enum]);
      if (!found)
        throw Error("no such Enum '" + path + "' in " + this);
      return found;
    };
    Namespace.prototype.lookupTypeOrEnum = function(path) {
      var found = this.lookup(path, [Type, Enum]);
      if (!found)
        throw Error("no such Type or Enum '" + path + "' in " + this);
      return found;
    };
    Namespace.prototype.lookupService = function(path) {
      var found = this.lookup(path, [Service]);
      if (!found)
        throw Error("no such Service '" + path + "' in " + this);
      return found;
    };
    Namespace._configure = function(Type_, Service_, Enum_) {
      Type = Type_, Service = Service_, Enum = Enum_;
    };
  }
});

// javascript/node_modules/protobufjs/src/mapfield.js
var require_mapfield = __commonJS({
  "javascript/node_modules/protobufjs/src/mapfield.js"(exports, module) {
    "use strict";
    module.exports = MapField;
    var Field = require_field();
    MapField.prototype = Object.create(Field.prototype, {
      constructor: {
        value: MapField,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    MapField.className = "MapField";
    var types = require_types3(), util2 = require_util();
    function MapField(name, id, keyType, type, options, comment) {
      if (Field.call(this, name, id, type, void 0, void 0, options, comment), !util2.isString(keyType))
        throw TypeError("keyType must be a string");
      this.keyType = keyType, this.resolvedKeyType = null, this.map = !0;
    }
    MapField.fromJSON = function(name, json) {
      var field = new MapField(name, json.id, json.keyType, json.type, json.options, json.comment);
      return json.protoName && (field.protoName = json.protoName), json.jsonName !== void 0 ? field.jsonName = json.jsonName : json.options && json.options.json_name !== void 0 && (field.jsonName = json.options.json_name), field;
    };
    MapField.prototype.toJSON = function(toJSONOptions) {
      var keepComments = toJSONOptions ? !!toJSONOptions.keepComments : !1;
      return util2.toObject([
        "keyType",
        this.keyType,
        "type",
        this.type,
        "id",
        this.id,
        "extend",
        this.extend,
        "protoName",
        this.protoName !== this.name ? this.protoName : void 0,
        "jsonName",
        this.jsonName !== util2.jsonName(this.protoName || this.name) ? this.jsonName : void 0,
        "options",
        this.options,
        "comment",
        keepComments ? this.comment : void 0
      ]);
    };
    MapField.prototype.resolve = function() {
      if (this.resolved)
        return this;
      if (types.mapKey[this.keyType] === void 0)
        throw Error("invalid key type: " + this.keyType);
      return Field.prototype.resolve.call(this);
    };
    MapField.d = function(fieldId, fieldKeyType, fieldValueType) {
      return typeof fieldValueType == "function" ? fieldValueType = util2.decorateType(fieldValueType).name : fieldValueType && typeof fieldValueType == "object" && (fieldValueType = util2.decorateEnum(fieldValueType).name), function(prototype, fieldName) {
        util2.decorateType(prototype.constructor).add(new MapField(fieldName, fieldId, fieldKeyType, fieldValueType));
      };
    };
  }
});

// javascript/node_modules/protobufjs/src/method.js
var require_method = __commonJS({
  "javascript/node_modules/protobufjs/src/method.js"(exports, module) {
    "use strict";
    module.exports = Method;
    var ReflectionObject = require_object();
    Method.prototype = Object.create(ReflectionObject.prototype, {
      constructor: {
        value: Method,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    Method.className = "Method";
    var util2 = require_util();
    function Method(name, type, requestType, responseType, requestStream, responseStream, options, comment, parsedOptions) {
      if (util2.isObject(requestStream) ? (options = requestStream, requestStream = responseStream = void 0) : util2.isObject(responseStream) && (options = responseStream, responseStream = void 0), !(type === void 0 || util2.isString(type)))
        throw TypeError("type must be a string");
      if (!util2.isString(requestType))
        throw TypeError("requestType must be a string");
      if (!util2.isString(responseType))
        throw TypeError("responseType must be a string");
      ReflectionObject.call(this, name, options), this.type = type || "rpc", this.requestType = requestType, this.requestStream = requestStream ? !0 : void 0, this.responseType = responseType, this.responseStream = responseStream ? !0 : void 0, this.path = "/" + this.name, this.resolvedRequestType = null, this.resolvedResponseType = null, this.comment = comment, this.parsedOptions = parsedOptions;
    }
    Method.fromJSON = function(name, json) {
      return new Method(name, json.type, json.requestType, json.responseType, json.requestStream, json.responseStream, json.options, json.comment, json.parsedOptions);
    };
    Method.prototype.toJSON = function(toJSONOptions) {
      var keepComments = toJSONOptions ? !!toJSONOptions.keepComments : !1;
      return util2.toObject([
        "type",
        this.type !== "rpc" && /* istanbul ignore next */
        this.type || void 0,
        "requestType",
        this.requestType,
        "requestStream",
        this.requestStream,
        "responseType",
        this.responseType,
        "responseStream",
        this.responseStream,
        "options",
        this.options,
        "comment",
        keepComments ? this.comment : void 0,
        "parsedOptions",
        this.parsedOptions
      ]);
    };
    Method.prototype.resolve = function() {
      if (this.resolved)
        return this;
      if (this.parent) {
        var serviceName = this.parent.fullName;
        serviceName.charAt(0) === "." && (serviceName = serviceName.substring(1)), this.path = "/" + serviceName + "/" + this.name;
      } else
        this.path = "/" + this.name;
      return this.resolvedRequestType = this.parent.lookupType(this.requestType), this.resolvedResponseType = this.parent.lookupType(this.responseType), ReflectionObject.prototype.resolve.call(this);
    };
  }
});

// javascript/node_modules/protobufjs/src/service.js
var require_service3 = __commonJS({
  "javascript/node_modules/protobufjs/src/service.js"(exports, module) {
    "use strict";
    module.exports = Service;
    var Namespace = require_namespace();
    Service.prototype = Object.create(Namespace.prototype, {
      constructor: {
        value: Service,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    Service.className = "Service";
    var Method = require_method(), util2 = require_util(), rpc = require_rpc();
    function Service(name, options) {
      Namespace.call(this, name, options), this.methods = {}, this._methodsArray = null;
    }
    Service.fromJSON = function(name, json, depth) {
      if (depth === void 0 && (depth = 0), depth > util2.recursionLimit)
        throw Error("max depth exceeded");
      var service = new Service(name, json.options);
      if (json.methods)
        for (var names = Object.keys(json.methods), i = 0; i < names.length; ++i)
          service.add(Method.fromJSON(names[i], json.methods[names[i]]));
      return json.nested && service.addJSON(json.nested, depth), json.edition && (service._edition = json.edition), service.comment = json.comment, service._defaultEdition = "proto3", service;
    };
    Service.prototype.toJSON = function(toJSONOptions) {
      var inherited = Namespace.prototype.toJSON.call(this, toJSONOptions), keepComments = toJSONOptions ? !!toJSONOptions.keepComments : !1;
      return util2.toObject([
        "edition",
        this._editionToJSON(),
        "options",
        inherited && inherited.options || void 0,
        "methods",
        Namespace.arrayToJSON(this.methodsArray, toJSONOptions) || /* istanbul ignore next */
        {},
        "nested",
        inherited && inherited.nested || void 0,
        "comment",
        keepComments ? this.comment : void 0
      ]);
    };
    Object.defineProperty(Service.prototype, "methodsArray", {
      get: function() {
        return this._methodsArray || (this._methodsArray = util2.toArray(this.methods));
      }
    });
    function clearCache(service) {
      return service._methodsArray = null, service;
    }
    Service.prototype.get = function(name) {
      return Object.prototype.hasOwnProperty.call(this.methods, name) ? this.methods[name] : Namespace.prototype.get.call(this, name);
    };
    Service.prototype.resolveAll = function() {
      if (!this._needsRecursiveResolve) return this;
      Namespace.prototype.resolve.call(this);
      for (var methods = this.methodsArray, i = 0; i < methods.length; ++i)
        methods[i].resolve();
      return this;
    };
    Service.prototype._resolveFeaturesRecursive = function(edition) {
      return this._needsRecursiveFeatureResolution ? (edition = this._edition || edition, Namespace.prototype._resolveFeaturesRecursive.call(this, edition), this.methodsArray.forEach((method) => {
        method._resolveFeaturesRecursive(edition);
      }), this) : this;
    };
    Service.prototype.add = function(object) {
      if (this.get(object.name))
        throw Error("duplicate name '" + object.name + "' in " + this);
      return object instanceof Method ? object.name === "__proto__" ? this : (this.methods[object.name] = object, object.parent = this, clearCache(this)) : Namespace.prototype.add.call(this, object);
    };
    Service.prototype.remove = function(object) {
      if (object instanceof Method) {
        if (this.methods[object.name] !== object)
          throw Error(object + " is not a member of " + this);
        return delete this.methods[object.name], object.parent = null, clearCache(this);
      }
      return Namespace.prototype.remove.call(this, object);
    };
    Service.prototype.create = function(rpcImpl, requestDelimited, responseDelimited) {
      for (var rpcService = new rpc.Service(rpcImpl, requestDelimited, responseDelimited), i = 0, method; i < /* initializes */
      this.methodsArray.length; ++i) {
        var methodName = util2.lcFirst((method = this._methodsArray[i]).resolve().name).replace(/[^$\w_]/g, "");
        rpcService[methodName] = /* @__PURE__ */ (function(method2, requestType, responseType) {
          return function(request, callback) {
            return rpc.Service.prototype.rpcCall.call(this, method2, requestType, responseType, request, callback);
          };
        })(method, method.resolvedRequestType.ctor, method.resolvedResponseType.ctor);
      }
      return rpcService;
    };
  }
});

// javascript/node_modules/protobufjs/src/message.js
var require_message3 = __commonJS({
  "javascript/node_modules/protobufjs/src/message.js"(exports, module) {
    "use strict";
    module.exports = Message;
    var util2 = require_minimal();
    function Message(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          properties[keys[i]] != null && keys[i] !== "__proto__" && (this[keys[i]] = properties[keys[i]]);
    }
    Message.create = function(properties) {
      return this.$type.create(properties);
    };
    Message.encode = function(message, writer) {
      return this.$type.encode(message, writer);
    };
    Message.encodeDelimited = function(message, writer) {
      return this.$type.encodeDelimited(message, writer);
    };
    Message.decode = function(reader) {
      return this.$type.decode(reader);
    };
    Message.decodeDelimited = function(reader) {
      return this.$type.decodeDelimited(reader);
    };
    Message.verify = function(message) {
      return this.$type.verify(message);
    };
    Message.fromObject = function(object) {
      return this.$type.fromObject(object);
    };
    Message.toObject = function(message, options) {
      return this.$type.toObject(message, options);
    };
    Message.prototype.toJSON = function() {
      return this.$type.toObject(this, util2.toJSONOptions);
    };
  }
});

// javascript/node_modules/protobufjs/src/decoder.js
var require_decoder = __commonJS({
  "javascript/node_modules/protobufjs/src/decoder.js"(exports, module) {
    "use strict";
    module.exports = decoder;
    var Enum = require_enum2(), types = require_types3(), util2 = require_util();
    function missing(field) {
      return "missing required '" + field.name + "'";
    }
    function stringMethod(field) {
      return field._features.utf8_validation === "VERIFY" ? "stringVerify" : "string";
    }
    function genPreserveUnknown(gen, ref) {
      return gen("if(!r.discardUnknown){")('util.makeProp(m,"$unknowns",false);')("(m.$unknowns||(m.$unknowns=[])).push(%s)", ref)("}");
    }
    function decoder(mtype) {
      for (var hasMapField = !1, needsValueVar = !1, i = 0; i < mtype.fieldsArray.length; ++i) {
        var pfield = mtype._fieldsArray[i];
        pfield.map && (hasMapField = !0), (pfield.resolvedType instanceof Enum || !pfield.repeated && !pfield.map && !pfield.hasPresence) && (needsValueVar = !0);
      }
      var gen = util2.codegen(["r", "l", "z", "q", "g"])("if(!(r instanceof Reader))")("r=Reader.create(r)")("if(q===undefined)q=0")("if(q>Reader.recursionLimit)")('throw Error("max depth exceeded")')("var c,m" + (hasMapField ? ",k,v" : needsValueVar ? ",v" : ""))("if(l===undefined)")("c=r.len")("else{")("c=r.pos+l")("if(c>r.len)")('throw RangeError("index out of range")')("l=r.len")("r.len=c")("}")("m=g||new C")("while(r.pos<c){")("var s=r.pos")("var t=r.tag()")("if(t===z){")("z=undefined")("break")("}");
      for (mtype.fieldsArray.length && gen("var u=t&7")("switch(t>>>=3){"), i = 0; i < /* initializes */
      mtype.fieldsArray.length; ++i) {
        var field = mtype._fieldsArray[i].resolve(), type = field.resolvedType instanceof Enum ? "int32" : field.type, ref = "m" + util2.safeProp(field.name), closed = field.resolvedType instanceof Enum && field.resolvedType._features.enum_type === "CLOSED";
        if (field.map) {
          gen("case %i:{", field.id)("if(u!==2)")("break"), closed || gen("if(%s===util.emptyObject)", ref)("%s={}", ref), gen("var c2=r.uint32()+r.pos")("if(c2>r.len)")('throw RangeError("index out of range")')("r.len=c2"), types.defaults[field.keyType] !== void 0 ? gen("k=%j", types.defaults[field.keyType]) : gen("k=null"), types.long[type] !== void 0 ? gen("v=util.Long?util.Long.fromNumber(0,%j):0", type === "uint64" || type === "fixed64") : types.defaults[type] !== void 0 ? gen("v=%j", types.defaults[type]) : gen("v=null"), gen("while(r.pos<c2){")("var t2=r.tag()")("u=t2&7")("switch(t2>>>=3){")("case 1:")("if(u!==%i)", types.mapKey[field.keyType])("break")("k=r.%s()", field.keyType === "string" ? stringMethod(field) : field.keyType)("continue")("case 2:")("if(u!==%i)", types.basic[type] === void 0 ? 2 : types.basic[type])("break"), types.basic[type] === void 0 ? gen("v=types[%i].decode(r,r.uint32(),undefined,q+1,v)", i) : gen("v=r.%s()", type === "string" ? stringMethod(field) : type), gen("continue")("}")("r.skipType(u,q,t2)")("}"), gen("if(r.pos!==c2)")('throw RangeError("index out of range")')("r.len=c"), closed && (gen("if(types[%i].valuesById[v]===undefined){", i), genPreserveUnknown(gen, "r.raw(s,r.pos)")("continue")("}")("if(%s===util.emptyObject)", ref)("%s={}", ref));
          var val = types.basic[type] === void 0 ? "v||new types[" + i + "].ctor" : "v";
          types.long[field.keyType] !== void 0 ? gen('%s[typeof k==="object"?util.longToHash(k):k]=%s', ref, val) : (field.keyType === "string" && gen('if(k==="__proto__")')("util.makeProp(%s,k)", ref), gen("%s[k]=%s", ref, val));
        } else field.repeated ? (gen("case %i:", field.id)("{"), types.packed[type] !== void 0 && (gen("if(u===2){"), closed ? (gen("var c2=r.uint32()+r.pos")("if(c2>r.len)")('throw RangeError("index out of range")')("r.len=c2")("while(r.pos<c2){")("s=r.pos")("v=r.%s()", type)("if(types[%i].valuesById[v]!==undefined){", i)("if(!(%s&&%s.length))", ref, ref)("%s=[]", ref)("%s.push(v)", ref)("}else"), genPreserveUnknown(gen, "util.rawField(" + field.id + ",0,r.raw(s,r.pos))")("}"), gen("if(r.pos!==c2)")('throw RangeError("index out of range")')("r.len=c")) : gen("if(!(%s&&%s.length))", ref, ref)("%s=[]", ref)("r.%ss(%s)", type, ref), gen("continue")("}")), gen("if(u!==%i)", types.basic[type] === void 0 ? field.delimited ? 3 : 2 : types.basic[type])("break"), closed || gen("if(!(%s&&%s.length))", ref, ref)("%s=[]", ref), types.basic[type] === void 0 ? field.delimited ? gen("%s.push(types[%i].decode(r,undefined,%i,q+1))", ref, i, field.id * 8 + 4) : gen("%s.push(types[%i].decode(r,r.uint32(),undefined,q+1))", ref, i) : closed ? (gen("v=r.%s()", type)("if(types[%i].valuesById[v]!==undefined){", i)("if(!(%s&&%s.length))", ref, ref)("%s=[]", ref)("%s.push(v)", ref)("}else"), genPreserveUnknown(gen, "r.raw(s,r.pos)")) : gen("%s.push(r.%s())", ref, type === "string" ? stringMethod(field) : type)) : types.basic[type] === void 0 ? (gen("case %i:{", field.id)("if(u!==%i)", field.delimited ? 3 : 2)("break"), field.delimited ? gen("%s=types[%i].decode(r,undefined,%i,q+1,%s)", ref, i, field.id * 8 + 4, ref) : gen("%s=types[%i].decode(r,r.uint32(),undefined,q+1,%s)", ref, i, ref)) : field.hasPresence ? (gen("case %i:{", field.id)("if(u!==%i)", types.basic[type])("break"), closed ? (gen("v=r.%s()", type)("if(types[%i].valuesById[v]!==undefined){", i)("%s=v", ref), field.partOf && gen("m%s=%j", util2.safeProp(field.partOf.name), field.name), gen("}else"), genPreserveUnknown(gen, "r.raw(s,r.pos)")) : gen("%s=r.%s()", ref, type === "string" ? stringMethod(field) : type)) : (gen("case %i:{", field.id)("if(u!==%i)", types.basic[type])("break"), closed ? (gen("v=r.%s()", type)("if(types[%i].valuesById[v]!==undefined){", i)("if(v!==%j)", field.typeDefault)("%s=v", ref)("else")("delete %s", ref)("}else{"), genPreserveUnknown(gen, "r.raw(s,r.pos)")("}")) : (field.resolvedType instanceof Enum && field.typeDefault !== 0 ? gen("if((v=r.%s())!==%j)", type, field.typeDefault) : type === "string" ? gen("if((v=r.%s()).length)", stringMethod(field)) : type === "bytes" ? gen("if((v=r.%s()).length)", type) : types.long[type] !== void 0 ? gen('if(typeof(v=r.%s())==="object"?v.low||v.high:v!==0)', type) : gen(type === "double" || type === "float" ? "if(!Object.is(v=r.%s(),0))" : "if(v=r.%s())", type), gen("%s=v", ref)("else")("delete %s", ref)));
        field.partOf && !closed && gen("m%s=%j", util2.safeProp(field.partOf.name), field.name), gen("continue")("}");
      }
      for (i && gen("}"), gen("r.skipType(%s,q,t)", i ? "u" : "t&7"), genPreserveUnknown(gen, "r.raw(s,r.pos)")("}")("if(l!==undefined){")("if(r.pos!==c)")('throw RangeError("index out of range")')("r.len=l")("}")("if(z!==undefined)")('throw Error("missing end group")'), i = 0; i < mtype._fieldsArray.length; ++i) {
        var rfield = mtype._fieldsArray[i];
        rfield.required && gen("if(!Object.hasOwnProperty.call(m,%j))", rfield.name)("throw util.ProtocolError(%j,{instance:m})", missing(rfield));
      }
      return gen("return m");
    }
  }
});

// javascript/node_modules/protobufjs/src/verifier.js
var require_verifier = __commonJS({
  "javascript/node_modules/protobufjs/src/verifier.js"(exports, module) {
    "use strict";
    module.exports = verifier;
    var Enum = require_enum2(), util2 = require_util();
    function invalid(field, expected) {
      return field.name + ": " + expected + (field.repeated && expected !== "array" ? "[]" : field.map && expected !== "object" ? "{k:" + field.keyType + "}" : "") + " expected";
    }
    function genVerifyValue(gen, field, fieldIndex, ref) {
      var resolvedType = field.resolvedType;
      if (resolvedType)
        if (resolvedType instanceof Enum)
          if (resolvedType._features.enum_type === "CLOSED") {
            gen("switch(%s){", ref)("default:")("return%j", invalid(field, "enum value"));
            for (var keys = Object.keys(resolvedType.values), j = 0; j < keys.length; ++j) gen("case %i:", resolvedType.values[keys[j]]);
            gen("break")("}");
          } else gen('if(typeof %s!=="number"||(%s|0)!==%s)', ref, ref, ref)("return%j", invalid(field, "enum value"));
        else
          gen("{")("var e=types[%i].verify(%s,q+1);", fieldIndex, ref)("if(e)")("return%j+e", field.name + ".")("}");
      else
        switch (field.type) {
          case "int32":
          case "uint32":
          case "sint32":
          case "fixed32":
          case "sfixed32":
            gen("if(!util.isInteger(%s))", ref)("return%j", invalid(field, "integer"));
            break;
          case "int64":
          case "uint64":
          case "sint64":
          case "fixed64":
          case "sfixed64":
            gen("if(!util.isInteger(%s)&&!(%s&&util.isInteger(%s.low)&&util.isInteger(%s.high)))", ref, ref, ref, ref)("return%j", invalid(field, "integer|Long"));
            break;
          case "float":
          case "double":
            gen('if(typeof %s!=="number")', ref)("return%j", invalid(field, "number"));
            break;
          case "bool":
            gen('if(typeof %s!=="boolean")', ref)("return%j", invalid(field, "boolean"));
            break;
          case "string":
            gen("if(!util.isString(%s))", ref)("return%j", invalid(field, "string"));
            break;
          case "bytes":
            gen('if(!(%s&&typeof %s.length==="number"||util.isString(%s)))', ref, ref, ref)("return%j", invalid(field, "buffer"));
            break;
        }
      return gen;
    }
    function genVerifyKey(gen, field, ref) {
      switch (field.keyType) {
        case "int32":
        case "uint32":
        case "sint32":
        case "fixed32":
        case "sfixed32":
          gen("if(!util.key32Re.test(%s))", ref)("return%j", invalid(field, "integer key"));
          break;
        case "int64":
        case "uint64":
        case "sint64":
        case "fixed64":
        case "sfixed64":
          gen("if(!util.key64Re.test(%s))", ref)("return%j", invalid(field, "integer|Long key"));
          break;
        case "bool":
          gen("if(!util.key2Re.test(%s))", ref)("return%j", invalid(field, "boolean key"));
          break;
      }
      return gen;
    }
    function verifier(mtype) {
      var gen = util2.codegen(["m", "q"])('if(typeof m!=="object"||m===null)')("return%j", "object expected")("if(q===undefined)q=0")("if(q>util.recursionLimit)")("return%j", "max depth exceeded"), oneofs = mtype.oneofsArray, seenFirstField = {};
      oneofs.length && gen("var p={}");
      for (var i = 0; i < /* initializes */
      mtype.fieldsArray.length; ++i) {
        var field = mtype._fieldsArray[i].resolve(), ref = "m" + util2.safeProp(field.name);
        if (field.optional && gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j)){", ref, field.name), field.map)
          gen("if(!util.isObject(%s))", ref)("return%j", invalid(field, "object"))("var k=Object.keys(%s)", ref)("for(var i=0;i<k.length;++i){"), genVerifyKey(gen, field, "k[i]"), genVerifyValue(gen, field, i, ref + "[k[i]]")("}");
        else if (field.repeated)
          gen("if(!Array.isArray(%s))", ref)("return%j", invalid(field, "array"))("for(var i=0;i<%s.length;++i){", ref), genVerifyValue(gen, field, i, ref + "[i]")("}");
        else {
          if (field.partOf) {
            var oneofProp = util2.safeProp(field.partOf.name);
            seenFirstField[field.partOf.name] === 1 && gen("if(p%s===1)", oneofProp)("return%j", field.partOf.name + ": multiple values"), seenFirstField[field.partOf.name] = 1, gen("p%s=1", oneofProp);
          }
          genVerifyValue(gen, field, i, ref);
        }
        field.optional && gen("}");
      }
      return gen("return null");
    }
  }
});

// javascript/node_modules/protobufjs/src/converter.js
var require_converter = __commonJS({
  "javascript/node_modules/protobufjs/src/converter.js"(exports) {
    "use strict";
    var converter = exports, Enum = require_enum2(), types = require_types3(), util2 = require_util();
    function genValuePartial_fromObject(gen, field, fieldIndex, prop, dstProp) {
      if (field.resolvedType)
        if (field.resolvedType instanceof Enum) {
          var dst = dstProp ? "m" + dstProp + "[m" + dstProp + ".length]" : "m" + prop;
          gen("switch(d%s){", prop);
          for (var values = field.resolvedType.values, keys = Object.keys(values), i = 0; i < keys.length; ++i)
            gen("case%j:", keys[i])("case %i:", values[keys[i]])("%s=%j", dst, values[keys[i]])("break");
          gen("default:"), field.resolvedType._features.enum_type !== "CLOSED" && gen('if(typeof d%s==="number"&&(d%s|0)===d%s)', prop, prop, prop)("%s=d%s", dst, prop), gen("}");
        } else gen("if(!util.isObject(d%s))", prop)("throw TypeError(%j)", field.fullName + ": object expected")("m%s=types[%i].fromObject(d%s,q+1)", prop, fieldIndex, prop);
      else {
        var isUnsigned = !1;
        switch (field.type) {
          case "double":
          case "float":
            gen("m%s=Number(d%s)", prop, prop);
            break;
          case "uint32":
          case "fixed32":
            gen("m%s=d%s>>>0", prop, prop);
            break;
          case "int32":
          case "sint32":
          case "sfixed32":
            gen("m%s=d%s|0", prop, prop);
            break;
          case "uint64":
          case "fixed64":
            isUnsigned = !0;
          // eslint-disable-next-line no-fallthrough
          case "int64":
          case "sint64":
          case "sfixed64":
            gen("if(util.Long)")("m%s=util.Long.fromValue(d%s,%j)", prop, prop, isUnsigned)('else if(typeof d%s==="string")', prop)("m%s=parseInt(d%s,10)", prop, prop)('else if(typeof d%s==="number")', prop)("m%s=d%s", prop, prop)('else if(typeof d%s==="object")', prop)("m%s=new util.LongBits(d%s.low>>>0,d%s.high>>>0).toNumber(%s)", prop, prop, prop, isUnsigned ? "true" : "");
            break;
          case "bytes":
            gen('if(typeof d%s==="string")', prop)("util.base64.decode(d%s,m%s=util.newBuffer(util.base64.length(d%s)),0)", prop, prop, prop)("else if(d%s.length>=0)", prop)("m%s=d%s", prop, prop);
            break;
          case "string":
            gen("m%s=String(d%s)", prop, prop);
            break;
          case "bool":
            gen("m%s=Boolean(d%s)", prop, prop);
            break;
        }
      }
      return gen;
    }
    converter.fromObject = function(mtype) {
      var fields = mtype.fieldsArray, gen = util2.codegen(["d", "q"])("if(d instanceof C)")("return d")("if(!util.isObject(d))")("throw TypeError(%j)", mtype.fullName + ": object expected")("if(q===undefined)q=0")("if(q>util.recursionLimit)")('throw Error("max depth exceeded")');
      if (!fields.length) return gen("return new C");
      gen("var m=new C");
      for (var i = 0; i < fields.length; ++i) {
        var field = fields[i].resolve(), prop = util2.safeProp(field.name), implicitPresence = !field.hasPresence && !field.repeated && !field.map && (field.resolvedType instanceof Enum || types.basic[field.type] !== void 0);
        field.map ? (gen("if(d%s){", prop)("if(!util.isObject(d%s))", prop)("throw TypeError(%j)", field.fullName + ": object expected")("m%s={}", prop)("for(var ks=Object.keys(d%s),i=0;i<ks.length;++i){", prop), gen('if(ks[i]==="__proto__")')("util.makeProp(m%s,ks[i])", prop), genValuePartial_fromObject(
          gen,
          field,
          /* not sorted */
          i,
          prop + "[ks[i]]"
        )("}")("}")) : field.repeated ? (gen("if(d%s){", prop)("if(!Array.isArray(d%s))", prop)("throw TypeError(%j)", field.fullName + ": array expected"), field.resolvedType instanceof Enum ? gen("m%s=[]", prop) : gen("m%s=Array(d%s.length)", prop, prop), gen("for(var i=0;i<d%s.length;++i){", prop), genValuePartial_fromObject(
          gen,
          field,
          /* not sorted */
          i,
          prop + "[i]",
          field.resolvedType instanceof Enum ? prop : void 0
        )("}")("}")) : (field.resolvedType instanceof Enum || gen("if(d%s!=null){", prop), implicitPresence && (field.resolvedType instanceof Enum ? gen('if(d%s!==%j&&(typeof d%s!=="string"||types[%i].values[d%s]!==%j)){', prop, field.typeDefault, prop, i, prop, field.typeDefault) : field.type === "string" ? gen('if(typeof d%s!=="string"||d%s.length){', prop, prop) : field.type === "bytes" ? gen("if(d%s.length){", prop) : field.type === "bool" ? gen("if(d%s){", prop) : field.type === "double" || field.type === "float" ? gen("if(!Object.is(Number(d%s),0)){", prop) : types.long[field.type] !== void 0 ? gen('if(typeof d%s==="object"?d%s.low||d%s.high:Number(d%s)!==0){', prop, prop, prop, prop) : gen("if(Number(d%s)!==0){", prop)), genValuePartial_fromObject(
          gen,
          field,
          /* not sorted */
          i,
          prop
        ), implicitPresence && gen("}"), field.resolvedType instanceof Enum || gen("}"));
      }
      return gen("return m");
    };
    function genValuePartial_toObject(gen, field, fieldIndex, dstProp, srcProp) {
      if (srcProp || (srcProp = dstProp), field.resolvedType)
        field.resolvedType instanceof Enum ? gen("d%s=o.enums===String?(types[%i].values[m%s]===undefined?m%s:types[%i].values[m%s]):m%s", dstProp, fieldIndex, srcProp, srcProp, fieldIndex, srcProp, srcProp) : gen("d%s=types[%i].toObject(m%s,o,q+1)", dstProp, fieldIndex, srcProp);
      else {
        var isUnsigned = !1;
        switch (field.type) {
          case "double":
          case "float":
            gen("d%s=o.json&&!isFinite(m%s)?String(m%s):m%s", dstProp, srcProp, srcProp, srcProp);
            break;
          case "uint64":
          case "fixed64":
            isUnsigned = !0;
          // eslint-disable-next-line no-fallthrough
          case "int64":
          case "sint64":
          case "sfixed64":
            gen('if(typeof BigInt!=="undefined"&&o.longs===BigInt)')('d%s=typeof m%s==="number"?BigInt(m%s):util.Long.fromBits(m%s.low>>>0,m%s.high>>>0,%j).toBigInt()', dstProp, srcProp, srcProp, srcProp, srcProp, isUnsigned)('else if(typeof m%s==="number")', srcProp)("d%s=o.longs===String?String(m%s):m%s", dstProp, srcProp, srcProp)("else")("d%s=o.longs===String?util.Long.prototype.toString.call(m%s):o.longs===Number?new util.LongBits(m%s.low>>>0,m%s.high>>>0).toNumber(%s):m%s", dstProp, srcProp, srcProp, srcProp, isUnsigned ? "true" : "", srcProp);
            break;
          case "bytes":
            gen("d%s=o.bytes===String?util.base64.encode(m%s,0,m%s.length):o.bytes===Array?Array.prototype.slice.call(m%s):m%s", dstProp, srcProp, srcProp, srcProp, srcProp);
            break;
          default:
            gen("d%s=m%s", dstProp, srcProp);
            break;
        }
      }
      return gen;
    }
    converter.toObject = function(mtype) {
      var fields = mtype.fieldsArray.slice().sort(util2.compareFieldsById);
      if (!fields.length)
        return util2.codegen()("return {}");
      for (var gen = util2.codegen(["m", "o", "q"])("if(!o)")("o={}")("if(q===undefined)q=0")("if(q>util.recursionLimit)")('throw Error("max depth exceeded")')("var d={}"), repeatedFields = [], mapFields = [], normalFields = [], i = 0; i < fields.length; ++i)
        fields[i].partOf || (fields[i].resolve().repeated ? repeatedFields : fields[i].map ? mapFields : normalFields).push(fields[i]);
      if (repeatedFields.length) {
        for (gen("if(o.arrays||o.defaults){"), i = 0; i < repeatedFields.length; ++i) gen("d%s=[]", util2.safeProp(repeatedFields[i].name));
        gen("}");
      }
      if (mapFields.length) {
        for (gen("if(o.objects||o.defaults){"), i = 0; i < mapFields.length; ++i) gen("d%s={}", util2.safeProp(mapFields[i].name));
        gen("}");
      }
      if (normalFields.length) {
        for (gen("if(o.defaults){"), i = 0; i < normalFields.length; ++i) {
          var field = normalFields[i], prop = util2.safeProp(field.name);
          if (field.resolvedType instanceof Enum) gen("d%s=o.enums===String?%j:%j", prop, field.resolvedType.valuesById[field.typeDefault], field.typeDefault);
          else if (field.long) gen("if(util.Long){")("var n=new util.Long(%i,%i,%j)", field.typeDefault.low, field.typeDefault.high, field.typeDefault.unsigned)('d%s=o.longs===String?n.toString():o.longs===Number?n.toNumber():typeof BigInt!=="undefined"&&o.longs===BigInt?n.toBigInt():n', prop)("}else")('d%s=o.longs===String?%j:typeof BigInt!=="undefined"&&o.longs===BigInt?BigInt(%j):%i', prop, field.typeDefault.toString(), field.typeDefault.toString(), field.typeDefault.toNumber());
          else if (field.bytes) {
            var arrayDefault = Array.prototype.slice.call(field.typeDefault);
            gen("if(o.bytes===String)d%s=%j", prop, util2.base64.encode(field.typeDefault, 0, field.typeDefault.length))("else{")("d%s=%j", prop, arrayDefault)("if(o.bytes!==Array)d%s=util.newBuffer(d%s)", prop, prop)("}");
          } else (field.type === "double" || field.type === "float") && typeof field.typeDefault == "number" && (!isFinite(field.typeDefault) || Object.is(field.typeDefault, -0)) ? gen("d%s=%f", prop, field.typeDefault)("if(o.json&&!isFinite(d%s))d%s=String(d%s)", prop, prop, prop) : gen("d%s=%j", prop, field.typeDefault);
        }
        gen("}");
      }
      var hasKs2 = !1;
      for (i = 0; i < fields.length; ++i) {
        var field = fields[i], index = mtype._fieldsArray.indexOf(field), prop = util2.safeProp(field.name);
        if (field.map) {
          hasKs2 || (hasKs2 = !0, gen("var ks2")), gen("if(m%s&&(ks2=Object.keys(m%s)).length){", prop, prop)("d%s={}", prop);
          var longKey = types.long[field.keyType] !== void 0, srcProp = prop + "[ks2[j]]";
          gen("for(var j=0;j<ks2.length;++j){"), longKey && gen("var k2=util.longFromKey(ks2[j],%j).toString()", field.keyType === "uint64" || field.keyType === "fixed64"), gen('if(ks2[j]==="__proto__")')("util.makeProp(d%s,ks2[j])", prop), genValuePartial_toObject(
            gen,
            field,
            /* sorted */
            index,
            longKey ? prop + "[k2]" : srcProp,
            srcProp
          )("}");
        } else field.repeated ? (gen("if(m%s&&m%s.length){", prop, prop)("d%s=Array(m%s.length)", prop, prop)("for(var j=0;j<m%s.length;++j){", prop), genValuePartial_toObject(
          gen,
          field,
          /* sorted */
          index,
          prop + "[j]"
        )("}")) : (gen("if(m%s!=null&&Object.hasOwnProperty.call(m,%j)){", prop, field.name), genValuePartial_toObject(
          gen,
          field,
          /* sorted */
          index,
          prop
        ), field.partOf && !field.partOf.isProto3Optional && gen("if(o.oneofs)")("d%s=%j", util2.safeProp(field.partOf.name), field.name));
        gen("}");
      }
      return gen("return d");
    };
  }
});

// javascript/node_modules/protobufjs/src/wrappers.js
var require_wrappers2 = __commonJS({
  "javascript/node_modules/protobufjs/src/wrappers.js"(exports) {
    "use strict";
    var wrappers = exports, Message = require_message3(), util2 = require_minimal();
    wrappers[".google.protobuf.Any"] = {
      fromObject: function(object, depth) {
        if (depth === void 0 && (depth = 0), depth > util2.recursionLimit)
          throw Error("max depth exceeded");
        if (object && object["@type"]) {
          var name = object["@type"].substring(object["@type"].lastIndexOf("/") + 1), type = this.lookup(name, [this.constructor]);
          if (type) {
            var type_url = object["@type"].charAt(0) === "." ? object["@type"].slice(1) : object["@type"];
            return type_url.indexOf("/") === -1 && (type_url = "/" + type_url), this.create({
              type_url,
              value: type.encode(type.fromObject(object, depth + 1)).finish()
            });
          }
        }
        return this.fromObject(object, depth);
      },
      toObject: function(message, options, depth) {
        if (depth === void 0 && (depth = 0), depth > util2.recursionLimit)
          throw Error("max depth exceeded");
        var googleApi = "type.googleapis.com/", prefix = "", name = "";
        if (options && options.json && message.type_url && message.value) {
          name = message.type_url.substring(message.type_url.lastIndexOf("/") + 1), prefix = message.type_url.substring(0, message.type_url.lastIndexOf("/") + 1);
          var type = this.lookup(name, [this.constructor]);
          type && (message = type.decode(message.value, void 0, void 0, depth + 1));
        }
        if (!(message instanceof this.ctor) && message instanceof Message) {
          var object = message.$type.toObject(message, options, depth + 1), messageName = message.$type.fullName[0] === "." ? message.$type.fullName.slice(1) : message.$type.fullName;
          return prefix === "" && (prefix = googleApi), name = prefix + messageName, object["@type"] = name, object;
        }
        return this.toObject(message, options, depth);
      }
    };
  }
});

// javascript/node_modules/protobufjs/src/type.js
var require_type = __commonJS({
  "javascript/node_modules/protobufjs/src/type.js"(exports, module) {
    "use strict";
    module.exports = Type;
    var Namespace = require_namespace();
    Type.prototype = Object.create(Namespace.prototype, {
      constructor: {
        value: Type,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    Type.className = "Type";
    var Enum = require_enum2(), OneOf = require_oneof(), Field = require_field(), MapField = require_mapfield(), Service = require_service3(), Message = require_message3(), Reader = require_reader(), Writer = require_writer(), util2 = require_util(), encoder = require_encoder(), decoder = require_decoder(), verifier = require_verifier(), converter = require_converter(), wrappers = require_wrappers2();
    function Type(name, options) {
      name = name.replace(/\W/g, ""), Namespace.call(this, name, options), this.fields = {}, this.oneofs = void 0, this.extensions = void 0, this.reserved = void 0, this.group = void 0, this.visibility = void 0, this._fieldsById = null, this._fieldsArray = null, this._oneofsArray = null, this._ctor = null, this._fieldsByJsonName = null;
    }
    Object.defineProperties(Type.prototype, {
      /**
       * Message fields by id.
       * @name Type#fieldsById
       * @type {Object.<number,Field>}
       * @readonly
       */
      fieldsById: {
        get: function() {
          if (this._fieldsById)
            return this._fieldsById;
          this._fieldsById = {};
          for (var names = Object.keys(this.fields), i = 0; i < names.length; ++i) {
            var field = this.fields[names[i]], id = field.id;
            if (this._fieldsById[id])
              throw Error("duplicate id " + id + " in " + this);
            this._fieldsById[id] = field;
          }
          return this._fieldsById;
        }
      },
      /**
       * Fields of this message as an array for iteration.
       * @name Type#fieldsArray
       * @type {Field[]}
       * @readonly
       */
      fieldsArray: {
        get: function() {
          return this._fieldsArray || (this._fieldsArray = util2.toArray(this.fields));
        }
      },
      /**
       * Oneofs of this message as an array for iteration.
       * @name Type#oneofsArray
       * @type {OneOf[]}
       * @readonly
       */
      oneofsArray: {
        get: function() {
          return this._oneofsArray || (this._oneofsArray = util2.toArray(this.oneofs));
        }
      },
      /**
       * The registered constructor, if any registered, otherwise a generic constructor.
       * Assigning a function replaces the internal constructor. If the function does not extend {@link Message} yet, its prototype will be setup accordingly and static methods will be populated. If it already extends {@link Message}, it will just replace the internal constructor.
       * When assigning manually, add the type to its parent namespace/root first if fields reference other reflected types, because constructor setup resolves field defaults.
       * @name Type#ctor
       * @type {Constructor<{}>}
       */
      ctor: {
        get: function() {
          return this._ctor || (this.ctor = Type.generateConstructor(this)());
        },
        set: function(ctor) {
          var prototype = ctor.prototype;
          prototype instanceof Message || (ctor.prototype = new Message(), Object.defineProperty(ctor.prototype, "constructor", {
            value: ctor,
            writable: !0,
            enumerable: !1,
            configurable: !0
          }), util2.merge(ctor.prototype, prototype)), ctor.$type = ctor.prototype.$type = this, util2.merge(ctor, Message, !0), this._ctor = ctor, delete this.decode, delete this.fromObject;
          for (var i = 0, field; i < /* initializes */
          this.fieldsArray.length; ++i)
            field = this._fieldsArray[i].resolve(), ctor.prototype[field.name] = field.defaultValue;
          var ctorProperties = {};
          for (i = 0; i < /* initializes */
          this.oneofsArray.length; ++i)
            ctorProperties[this._oneofsArray[i].resolve().name] = {
              get: util2.oneOfGetter(this._oneofsArray[i].oneof),
              set: util2.oneOfSetter(this._oneofsArray[i].oneof)
            };
          i && Object.defineProperties(ctor.prototype, ctorProperties);
        }
      }
    });
    Type.generateConstructor = function(mtype) {
      for (var gen = util2.codegen(["p"]), i = 0, field; i < mtype.fieldsArray.length; ++i)
        (field = mtype._fieldsArray[i]).map ? gen("this%s={}", util2.safeProp(field.name)) : field.repeated && gen("this%s=[]", util2.safeProp(field.name));
      return gen('if(p)for(var ks=Object.keys(p),i=0;i<ks.length;++i)if(p[ks[i]]!=null&&ks[i]!=="__proto__")')("this[ks[i]]=p[ks[i]]");
    };
    function clearCache(type) {
      return type._fieldsById = type._fieldsArray = type._oneofsArray = type._fieldsByJsonName = null, delete type.encode, delete type.decode, delete type.verify, type;
    }
    Type.fromJSON = function(name, json, depth) {
      if (depth === void 0 && (depth = 0), depth > util2.nestingLimit)
        throw Error("max depth exceeded");
      var type = new Type(name, json.options);
      type.extensions = json.extensions, type.reserved = json.reserved;
      for (var names = Object.keys(json.fields), i = 0; i < names.length; ++i)
        type.add(
          (typeof json.fields[names[i]].keyType < "u" ? MapField.fromJSON : Field.fromJSON)(names[i], json.fields[names[i]])
        );
      if (json.oneofs)
        for (names = Object.keys(json.oneofs), i = 0; i < names.length; ++i)
          type.add(OneOf.fromJSON(names[i], json.oneofs[names[i]]));
      if (json.nested)
        for (names = Object.keys(json.nested), i = 0; i < names.length; ++i) {
          var nested = json.nested[names[i]];
          type.add(
            // most to least likely
            (nested.id !== void 0 ? Field.fromJSON : nested.fields !== void 0 ? Type.fromJSON : nested.values !== void 0 ? Enum.fromJSON : nested.methods !== void 0 ? Service.fromJSON : Namespace.fromJSON)(names[i], nested, depth + 1)
          );
        }
      return json.extensions && json.extensions.length && (type.extensions = json.extensions), json.reserved && json.reserved.length && (type.reserved = json.reserved), json.group && (type.group = !0), json.visibility && (type.visibility = json.visibility), json.comment && (type.comment = json.comment), json.edition && (type._edition = json.edition), type._defaultEdition = "proto3", type;
    };
    Type.prototype.toJSON = function(toJSONOptions) {
      var inherited = Namespace.prototype.toJSON.call(this, toJSONOptions), keepComments = toJSONOptions ? !!toJSONOptions.keepComments : !1;
      return util2.toObject([
        "edition",
        this._editionToJSON(),
        "options",
        inherited && inherited.options || void 0,
        "oneofs",
        Namespace.arrayToJSON(this.oneofsArray, toJSONOptions),
        "fields",
        Namespace.arrayToJSON(this.fieldsArray.filter(function(obj) {
          return !obj.declaringField;
        }), toJSONOptions) || {},
        "extensions",
        this.extensions && this.extensions.length ? this.extensions : void 0,
        "reserved",
        this.reserved && this.reserved.length ? this.reserved : void 0,
        "group",
        this.group || void 0,
        "visibility",
        this.visibility,
        "nested",
        inherited && inherited.nested || void 0,
        "comment",
        keepComments ? this.comment : void 0
      ]);
    };
    Type.prototype.resolveAll = function() {
      if (!this._needsRecursiveResolve) return this;
      Namespace.prototype.resolveAll.call(this);
      var oneofs = this.oneofsArray;
      for (i = 0; i < oneofs.length; )
        oneofs[i++].resolve();
      for (var fields = this.fieldsArray, i = 0; i < fields.length; )
        fields[i++].resolve();
      return this;
    };
    Type.prototype._resolveFeaturesRecursive = function(edition) {
      return this._needsRecursiveFeatureResolution ? (edition = this._edition || edition, Namespace.prototype._resolveFeaturesRecursive.call(this, edition), this.oneofsArray.forEach((oneof) => {
        oneof._resolveFeatures(edition);
      }), this.fieldsArray.forEach((field) => {
        field._resolveFeatures(edition);
      }), this) : this;
    };
    Type.prototype.get = function(name) {
      return Object.prototype.hasOwnProperty.call(this.fields, name) ? this.fields[name] : this.oneofs && Object.prototype.hasOwnProperty.call(this.oneofs, name) ? this.oneofs[name] : this.nested && Object.prototype.hasOwnProperty.call(this.nested, name) ? this.nested[name] : null;
    };
    Type.prototype.add = function(object) {
      if (this.get(object.name))
        throw Error("duplicate name '" + object.name + "' in " + this);
      if (object instanceof Field && object.extend === void 0) {
        if (this._fieldsById ? (
          /* istanbul ignore next */
          this._fieldsById[object.id]
        ) : this.fieldsById[object.id])
          throw Error("duplicate id " + object.id + " in " + this);
        if (this.isReservedId(object.id))
          throw Error("id " + object.id + " is reserved in " + this);
        if (this.isReservedName(object.name) || object.name.charAt(0) === "$")
          throw Error("name '" + object.name + "' is reserved in " + this);
        return object.name === "__proto__" ? this : (object.parent && object.parent.remove(object), this.fields[object.name] = object, object.message = this, object.onAdd(this), clearCache(this));
      }
      if (object instanceof OneOf) {
        if (object.name.charAt(0) === "$")
          throw Error("name '" + object.name + "' is reserved in " + this);
        return object.name === "__proto__" ? this : (this.oneofs || (this.oneofs = {}), this.oneofs[object.name] = object, object.onAdd(this), clearCache(this));
      }
      return Namespace.prototype.add.call(this, object);
    };
    Type.prototype.remove = function(object) {
      if (object instanceof Field && object.extend === void 0) {
        if (!util2.remove(this.fields, object, object.name))
          throw Error(object + " is not a member of " + this);
        return object.parent = null, object.onRemove(this), clearCache(this);
      }
      if (object instanceof OneOf) {
        if (!util2.remove(this.oneofs, object, object.name))
          throw Error(object + " is not a member of " + this);
        return object.parent = null, object.onRemove(this), clearCache(this);
      }
      return Namespace.prototype.remove.call(this, object);
    };
    Type.prototype.isReservedId = function(id) {
      return Namespace.isReservedId(this.reserved, id);
    };
    Type.prototype.isReservedName = function(name) {
      return Namespace.isReservedName(this.reserved, name);
    };
    Type.prototype.create = function(properties) {
      return new this.ctor(properties);
    };
    Type.prototype.setup = function() {
      var root = this.root;
      if (root && root._needsRecursiveFeatureResolution) {
        var edition = root._edition || this._edition;
        edition && root._resolveFeaturesRecursive(edition);
      }
      for (var fullName = this.fullName, types = [], i = 0; i < /* initializes */
      this.fieldsArray.length; ++i)
        types.push(this._fieldsArray[i].resolve().resolvedType);
      this.encode = encoder(this)({
        Writer,
        types,
        util: util2
      }), this.decode = decoder(this)({
        Reader,
        types,
        util: util2,
        C: this.ctor
      }), this.verify = verifier(this)({
        types,
        util: util2
      }), this.fromObject = converter.fromObject(this)({
        types,
        util: util2,
        C: this.ctor
      }), this.toObject = converter.toObject(this)({
        types,
        util: util2
      });
      var wrapper = wrappers[fullName];
      if (wrapper) {
        var wrapperThis = Object.create(this);
        wrapperThis._ctor = this.ctor, wrapperThis.fromObject = this.fromObject, this.fromObject = wrapper.fromObject.bind(wrapperThis), wrapperThis.toObject = this.toObject, this.toObject = wrapper.toObject.bind(wrapperThis);
      }
      return this;
    };
    Type.prototype.encode = function(message, writer) {
      return this.setup().encode.apply(this, arguments);
    };
    Type.prototype.encodeDelimited = function(message, writer) {
      return this.encode(message, (writer || Writer.create()).fork()).ldelim();
    };
    Type.prototype.decode = function(reader, length) {
      return this.setup().decode.apply(this, arguments);
    };
    Type.prototype.decodeDelimited = function(reader) {
      return reader instanceof Reader || (reader = Reader.create(reader)), this.decode(reader, reader.uint32());
    };
    Type.prototype.verify = function(message) {
      return this.setup().verify.apply(this, arguments);
    };
    Type.prototype.fromObject = function(object) {
      return this.setup().fromObject.apply(this, arguments);
    };
    Type.prototype.toObject = function(message, options) {
      return this.setup().toObject.apply(this, arguments);
    };
    Type.prototype.getTypeUrl = function(prefix) {
      prefix === void 0 && (prefix = "type.googleapis.com");
      var fullName = this.fullName;
      return prefix + "/" + (fullName.charAt(0) === "." ? fullName.substring(1) : fullName);
    };
    Type.d = function(typeName) {
      return function(target) {
        util2.decorateType(target, typeName);
      };
    };
  }
});

// javascript/node_modules/protobufjs/src/root.js
var require_root = __commonJS({
  "javascript/node_modules/protobufjs/src/root.js"(exports, module) {
    "use strict";
    module.exports = Root;
    var Namespace = require_namespace();
    Root.prototype = Object.create(Namespace.prototype, {
      constructor: {
        value: Root,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    Root.className = "Root";
    var Field = require_field(), Enum = require_enum2(), OneOf = require_oneof(), util2 = require_util(), Type, parse2, common;
    function Root(options) {
      Namespace.call(this, "", options), this.deferred = [], this.files = [], this._edition = "proto2", this._fullyQualifiedObjects = {};
    }
    Root.fromJSON = function(json, root, depth) {
      if (depth === void 0 && (depth = 0), depth > util2.recursionLimit)
        throw Error("max depth exceeded");
      return root || (root = new Root()), json.options && root.setOptions(json.options), root.addJSON(json.nested, depth).resolveAll();
    };
    Root.prototype.resolvePath = util2.path.resolve;
    Root.prototype.fetch = util2.fetch;
    function SYNC() {
    }
    Root.prototype.load = function load(filename, options, callback) {
      typeof options == "function" && (callback = options, options = void 0);
      var self2 = this;
      if (!callback)
        return util2.asPromise(load, self2, filename, options);
      var sync = callback === SYNC;
      function finish(err, root) {
        if (callback) {
          if (sync)
            throw err;
          root && root.resolveAll();
          var cb = callback;
          callback = null, cb(err, root);
        }
      }
      function getBundledFileName(filename2) {
        var idx = filename2.lastIndexOf("google/protobuf/");
        if (idx > -1) {
          var altname = filename2.substring(idx);
          if (Object.prototype.hasOwnProperty.call(common, altname)) return altname;
        }
        return Object.prototype.hasOwnProperty.call(common, filename2) ? filename2 : null;
      }
      function process2(filename2, source, depth) {
        depth === void 0 && (depth = 0);
        try {
          if (depth > util2.recursionLimit)
            throw Error("max depth exceeded");
          if (util2.isString(source) && source.charAt(0) === "{" && (source = JSON.parse(source)), !util2.isString(source))
            self2.setOptions(source.options).addJSON(source.nested);
          else {
            parse2.filename = filename2;
            var parsed = parse2(source, self2, options), resolved2, i2 = 0;
            if (parsed.imports)
              for (; i2 < parsed.imports.length; ++i2)
                (resolved2 = getBundledFileName(parsed.imports[i2]) || self2.resolvePath(filename2, parsed.imports[i2])) && fetch2(resolved2, !1, depth + 1);
            if (parsed.weakImports)
              for (i2 = 0; i2 < parsed.weakImports.length; ++i2)
                (resolved2 = getBundledFileName(parsed.weakImports[i2]) || self2.resolvePath(filename2, parsed.weakImports[i2])) && fetch2(resolved2, !0, depth + 1);
          }
        } catch (err) {
          finish(err);
        }
        !sync && !queued && finish(null, self2);
      }
      function fetch2(filename2, weak, depth) {
        if (depth === void 0 && (depth = 0), filename2 = getBundledFileName(filename2) || filename2, !(self2.files.indexOf(filename2) > -1)) {
          if (self2.files.push(filename2), Object.prototype.hasOwnProperty.call(common, filename2)) {
            sync ? process2(filename2, common[filename2], depth) : (++queued, setTimeout(function() {
              --queued, process2(filename2, common[filename2], depth);
            }));
            return;
          }
          if (sync) {
            var source;
            try {
              source = util2.fs.readFileSync(filename2).toString("utf8");
            } catch (err) {
              weak || finish(err);
              return;
            }
            process2(filename2, source, depth);
          } else
            ++queued, self2.fetch(filename2, function(err, source2) {
              if (--queued, !!callback) {
                if (err) {
                  weak ? queued || finish(null, self2) : finish(err);
                  return;
                }
                process2(filename2, source2, depth);
              }
            });
        }
      }
      var queued = 0;
      util2.isString(filename) && (filename = [filename]);
      for (var i = 0, resolved; i < filename.length; ++i)
        (resolved = self2.resolvePath("", filename[i])) && fetch2(resolved);
      return sync ? (self2.resolveAll(), self2) : (queued || finish(null, self2), self2);
    };
    Root.prototype.loadSync = function(filename, options) {
      if (!util2.isNode)
        throw Error("not supported");
      return this.load(filename, options, SYNC);
    };
    Root.prototype.resolveAll = function() {
      if (!this._needsRecursiveResolve) return this;
      if (this.deferred.length)
        throw Error("unresolvable extensions: " + this.deferred.map(function(field) {
          return "'extend " + field.extend + "' in " + field.parent.fullName;
        }).join(", "));
      return Namespace.prototype.resolveAll.call(this);
    };
    var exposeRe = /^[A-Z]/;
    function tryHandleExtension(root, field) {
      var extendedType = field.parent.lookup(field.extend);
      if (extendedType) {
        var sisterField = new Field(field.fullName, field.id, field.type, field.rule, void 0, field.options);
        return extendedType.get(sisterField.name) || (sisterField.declaringField = field, field.extensionField = sisterField, extendedType.add(sisterField)), !0;
      }
      return !1;
    }
    Root.prototype._handleAdd = function(object) {
      if (object instanceof Field)
        /* an extension field (implies not part of a oneof) */
        object.extend !== void 0 && /* not already handled */
        !object.extensionField && (tryHandleExtension(this, object) || this.deferred.push(object));
      else if (object instanceof Enum)
        exposeRe.test(object.name) && (object.parent[object.name] = object.values);
      else if (!(object instanceof OneOf)) {
        if (object instanceof Type)
          for (var i = 0; i < this.deferred.length; )
            tryHandleExtension(this, this.deferred[i]) ? this.deferred.splice(i, 1) : ++i;
        for (var j = 0; j < /* initializes */
        object.nestedArray.length; ++j)
          this._handleAdd(object._nestedArray[j]);
        exposeRe.test(object.name) && (object.parent[object.name] = object);
      }
      (object instanceof Type || object instanceof Enum || object instanceof Field) && (this._fullyQualifiedObjects[object.fullName] = object);
    };
    Root.prototype._handleRemove = function(object) {
      if (object instanceof Field) {
        if (
          /* an extension field */
          object.extend !== void 0
        )
          if (
            /* already handled */
            object.extensionField
          )
            object.extensionField.parent.remove(object.extensionField), object.extensionField = null;
          else {
            var index = this.deferred.indexOf(object);
            index > -1 && this.deferred.splice(index, 1);
          }
      } else if (object instanceof Enum)
        exposeRe.test(object.name) && delete object.parent[object.name];
      else if (object instanceof Namespace) {
        for (var i = 0; i < /* initializes */
        object.nestedArray.length; ++i)
          this._handleRemove(object._nestedArray[i]);
        exposeRe.test(object.name) && delete object.parent[object.name];
      }
      delete this._fullyQualifiedObjects[object.fullName];
    };
    Root._configure = function(Type_, parse_, common_) {
      Type = Type_, parse2 = parse_, common = common_;
    };
  }
});

// javascript/node_modules/protobufjs/src/util.js
var require_util = __commonJS({
  "javascript/node_modules/protobufjs/src/util.js"(exports, module) {
    "use strict";
    var util2 = module.exports = require_minimal(), roots = require_roots(), Type, Enum;
    util2.codegen = require_codegen();
    util2.fetch = require_fetch();
    util2.path = require_path();
    util2.patterns = require_patterns();
    var reservedRe = util2.patterns.reservedRe;
    util2.fs = require_fs2();
    util2.toArray = function(object) {
      if (object) {
        for (var keys = Object.keys(object), array = new Array(keys.length), index = 0; index < keys.length; )
          array[index] = object[keys[index++]];
        return array;
      }
      return [];
    };
    util2.toObject = function(array) {
      for (var object = {}, index = 0; index < array.length; ) {
        var key = array[index++], val = array[index++];
        val !== void 0 && (object[key] = val);
      }
      return object;
    };
    util2.remove = function(object, value, key) {
      if (!object)
        return !1;
      if (key !== void 0 && Object.prototype.hasOwnProperty.call(object, key) && object[key] === value)
        return delete object[key], !0;
      for (var names = Object.keys(object), i = 0; i < names.length; ++i)
        if (object[names[i]] === value)
          return delete object[names[i]], !0;
      return !1;
    };
    util2.isReserved = function(name) {
      return reservedRe.test(name);
    };
    util2.safeProp = function(prop) {
      return !/^[$\w_]+$/.test(prop) || reservedRe.test(prop) ? "[" + JSON.stringify(prop) + "]" : "." + prop;
    };
    util2.ucFirst = function(str) {
      return str.charAt(0).toUpperCase() + str.substring(1);
    };
    var camelCaseRe = /_([a-z])/g;
    util2.camelCase = function(str) {
      return str.substring(0, 1) + str.substring(1).replace(camelCaseRe, function($0, $1) {
        return $1.toUpperCase();
      });
    };
    util2.jsonName = function(str) {
      for (var result = "", upperNext = !1, i = 0; i < str.length; ++i) {
        var ch = str.charAt(i);
        ch === "_" ? upperNext = !0 : upperNext ? (result += ch.toUpperCase(), upperNext = !1) : result += ch;
      }
      return result;
    };
    util2.compareFieldsById = function(a, b) {
      return a.id - b.id;
    };
    util2.decorateType = function(ctor, typeName) {
      if (ctor.$type)
        return typeName && ctor.$type.name !== typeName && (util2.decorateRoot.remove(ctor.$type), ctor.$type.name = typeName, util2.decorateRoot.add(ctor.$type)), ctor.$type;
      Type || (Type = require_type());
      var type = new Type(typeName || ctor.name);
      return util2.decorateRoot.add(type), type.ctor = ctor, Object.defineProperty(ctor, "$type", { value: type, enumerable: !1 }), Object.defineProperty(ctor.prototype, "$type", { value: type, enumerable: !1 }), type;
    };
    var decorateEnumIndex = 0;
    util2.decorateEnum = function(object) {
      if (object.$type)
        return object.$type;
      Enum || (Enum = require_enum2());
      var enm = new Enum("Enum" + decorateEnumIndex++, object);
      return util2.decorateRoot.add(enm), Object.defineProperty(object, "$type", { value: enm, enumerable: !1 }), enm;
    };
    util2.setProperty = function(dst, path, value, ifNotSet) {
      function setProp(dst2, path2, value2) {
        var part = path2.shift();
        if (util2.isUnsafeProperty(part))
          return dst2;
        if (path2.length > 0)
          dst2[part] = setProp(dst2[part] || {}, path2, value2);
        else {
          var prevValue = dst2[part];
          if (prevValue && ifNotSet)
            return dst2;
          prevValue && (value2 = [].concat(prevValue).concat(value2)), dst2[part] = value2;
        }
        return dst2;
      }
      if (typeof dst != "object")
        throw TypeError("dst must be an object");
      if (!path)
        throw TypeError("path must be specified");
      if (path = path.split("."), path.length > util2.recursionLimit)
        throw Error("max depth exceeded");
      return setProp(dst, path, value);
    };
    Object.defineProperty(util2, "decorateRoot", {
      get: function() {
        return roots.decorated || (roots.decorated = new (require_root())());
      }
    });
  }
});

// javascript/node_modules/protobufjs/src/types.js
var require_types3 = __commonJS({
  "javascript/node_modules/protobufjs/src/types.js"(exports) {
    "use strict";
    var types = exports, util2 = require_util(), s = [
      "double",
      // 0
      "float",
      // 1
      "int32",
      // 2
      "uint32",
      // 3
      "sint32",
      // 4
      "fixed32",
      // 5
      "sfixed32",
      // 6
      "int64",
      // 7
      "uint64",
      // 8
      "sint64",
      // 9
      "fixed64",
      // 10
      "sfixed64",
      // 11
      "bool",
      // 12
      "string",
      // 13
      "bytes"
      // 14
    ];
    function bake(values, offset) {
      var i = 0, o = /* @__PURE__ */ Object.create(null);
      for (offset |= 0; i < values.length; ) o[s[i + offset]] = values[i++];
      return o;
    }
    types.basic = bake([
      /* double   */
      1,
      /* float    */
      5,
      /* int32    */
      0,
      /* uint32   */
      0,
      /* sint32   */
      0,
      /* fixed32  */
      5,
      /* sfixed32 */
      5,
      /* int64    */
      0,
      /* uint64   */
      0,
      /* sint64   */
      0,
      /* fixed64  */
      1,
      /* sfixed64 */
      1,
      /* bool     */
      0,
      /* string   */
      2,
      /* bytes    */
      2
    ]);
    types.defaults = bake([
      /* double   */
      0,
      /* float    */
      0,
      /* int32    */
      0,
      /* uint32   */
      0,
      /* sint32   */
      0,
      /* fixed32  */
      0,
      /* sfixed32 */
      0,
      /* int64    */
      0,
      /* uint64   */
      0,
      /* sint64   */
      0,
      /* fixed64  */
      0,
      /* sfixed64 */
      0,
      /* bool     */
      !1,
      /* string   */
      "",
      /* bytes    */
      util2.emptyArray,
      /* message  */
      null
    ]);
    types.long = bake([
      /* int64    */
      0,
      /* uint64   */
      0,
      /* sint64   */
      0,
      /* fixed64  */
      1,
      /* sfixed64 */
      1
    ], 7);
    types.mapKey = bake([
      /* int32    */
      0,
      /* uint32   */
      0,
      /* sint32   */
      0,
      /* fixed32  */
      5,
      /* sfixed32 */
      5,
      /* int64    */
      0,
      /* uint64   */
      0,
      /* sint64   */
      0,
      /* fixed64  */
      1,
      /* sfixed64 */
      1,
      /* bool     */
      0,
      /* string   */
      2
    ], 2);
    types.packed = bake([
      /* double   */
      1,
      /* float    */
      5,
      /* int32    */
      0,
      /* uint32   */
      0,
      /* sint32   */
      0,
      /* fixed32  */
      5,
      /* sfixed32 */
      5,
      /* int64    */
      0,
      /* uint64   */
      0,
      /* sint64   */
      0,
      /* fixed64  */
      1,
      /* sfixed64 */
      1,
      /* bool     */
      0
    ]);
  }
});

// javascript/node_modules/protobufjs/src/field.js
var require_field = __commonJS({
  "javascript/node_modules/protobufjs/src/field.js"(exports, module) {
    "use strict";
    module.exports = Field;
    var ReflectionObject = require_object();
    Field.prototype = Object.create(ReflectionObject.prototype, {
      constructor: {
        value: Field,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    Field.className = "Field";
    var Enum = require_enum2(), types = require_types3(), util2 = require_util(), Type, ruleRe = /^(?:required|optional|repeated)$/;
    Field.fromJSON = function(name, json) {
      var field = new Field(name, json.id, json.type, json.rule, json.extend, json.options, json.comment);
      return json.edition && (field._edition = json.edition), json.protoName && (field.protoName = json.protoName), json.jsonName !== void 0 ? field.jsonName = json.jsonName : json.options && json.options.json_name !== void 0 && (field.jsonName = json.options.json_name), field._defaultEdition = "proto3", field;
    };
    function Field(name, id, type, rule, extend, options, comment) {
      if (util2.isObject(rule) ? (comment = extend, options = rule, rule = extend = void 0) : util2.isObject(extend) && (comment = options, options = extend, extend = void 0), ReflectionObject.call(this, name, options), !util2.isInteger(id) || id < 0)
        throw TypeError("id must be a non-negative integer");
      if (!util2.isString(type))
        throw TypeError("type must be a string");
      if (rule !== void 0 && !ruleRe.test(rule = rule.toString().toLowerCase()))
        throw TypeError("rule must be a string rule");
      if (extend !== void 0 && !util2.isString(extend))
        throw TypeError("extend must be a string");
      this.rule = rule && rule !== "optional" ? rule : void 0, this.type = type, this.id = id, this.extend = extend || void 0, this.repeated = rule === "repeated", this.map = !1, this.message = null, this.partOf = null, this.typeDefault = null, this.defaultValue = null, this.long = util2.Long ? types.long[type] !== void 0 : (
        /* istanbul ignore next */
        !1
      ), this.bytes = type === "bytes", this.resolvedType = null, this.extensionField = null, this.declaringField = null, this.comment = comment, this.protoName = void 0, this.jsonName = void 0;
    }
    Object.defineProperty(Field.prototype, "required", {
      get: function() {
        return this._features.field_presence === "LEGACY_REQUIRED";
      }
    });
    Object.defineProperty(Field.prototype, "optional", {
      get: function() {
        return !this.required;
      }
    });
    Object.defineProperty(Field.prototype, "delimited", {
      get: function() {
        return this.resolvedType instanceof Type && this._features.message_encoding === "DELIMITED";
      }
    });
    Object.defineProperty(Field.prototype, "packed", {
      get: function() {
        return this._features.repeated_field_encoding === "PACKED";
      }
    });
    Object.defineProperty(Field.prototype, "hasPresence", {
      get: function() {
        return this.repeated || this.map ? !1 : this.partOf || // oneofs
        this.declaringField || this.extensionField || // extensions
        this._features.field_presence !== "IMPLICIT";
      }
    });
    Field.prototype.setOption = function(name, value, ifNotSet) {
      return ReflectionObject.prototype.setOption.call(this, name, value, ifNotSet);
    };
    Field.prototype.toJSON = function(toJSONOptions) {
      var keepComments = toJSONOptions ? !!toJSONOptions.keepComments : !1;
      return util2.toObject([
        "edition",
        this._editionToJSON(),
        "rule",
        this.rule !== "optional" && this.rule || void 0,
        "type",
        this.type,
        "id",
        this.id,
        "extend",
        this.extend,
        "protoName",
        this.protoName !== this.name ? this.protoName : void 0,
        "jsonName",
        this.jsonName !== util2.jsonName(this.protoName || this.name) ? this.jsonName : void 0,
        "options",
        this.options,
        "comment",
        keepComments ? this.comment : void 0
      ]);
    };
    Field.prototype.resolve = function() {
      if (this.resolved)
        return this;
      if ((this.typeDefault = types.defaults[this.type]) === void 0 ? (this.resolvedType = (this.declaringField ? this.declaringField.parent : this.parent).lookupTypeOrEnum(this.type), this.resolvedType instanceof Type ? this.typeDefault = null : this.typeDefault = this.resolvedType.values[Object.keys(this.resolvedType.values)[0]]) : this.options && this.options.proto3_optional && (this.typeDefault = null), this.options && this.options.default != null && (this.typeDefault = this.options.default, this.resolvedType instanceof Enum && typeof this.typeDefault == "string" && (this.typeDefault = this.resolvedType.values[this.typeDefault])), this.options && (this.options.packed !== void 0 && this.resolvedType && !(this.resolvedType instanceof Enum) && delete this.options.packed, Object.keys(this.options).length || (this.options = void 0)), this.long) {
        var unsigned = this.type === "uint64" || this.type === "fixed64";
        this.typeDefault = typeof this.typeDefault == "string" ? util2.Long.fromString(this.typeDefault, unsigned) : util2.Long.fromNumber(this.typeDefault, unsigned), Object.freeze && Object.freeze(this.typeDefault);
      } else if (types.long[this.type] !== void 0 && typeof this.typeDefault == "string")
        this.typeDefault = parseInt(this.typeDefault, 10);
      else if (this.bytes && typeof this.typeDefault == "string") {
        var buf;
        util2.base64.test(this.typeDefault) ? util2.base64.decode(this.typeDefault, buf = util2.newBuffer(util2.base64.length(this.typeDefault)), 0) : util2.utf8.write(this.typeDefault, buf = util2.newBuffer(util2.utf8.length(this.typeDefault)), 0), this.typeDefault = buf;
      }
      return this.map ? this.defaultValue = util2.emptyObject : this.repeated ? this.defaultValue = util2.emptyArray : this.defaultValue = this.typeDefault, this.parent instanceof Type && this.parent._ctor && (this.parent._ctor.prototype[this.name] = this.defaultValue), this.protoName === void 0 && (this.protoName = this.name), this.jsonName === void 0 && (this.jsonName = util2.jsonName(this.protoName)), ReflectionObject.prototype.resolve.call(this);
    };
    Field.prototype._inferLegacyProtoFeatures = function(edition) {
      if (edition !== "proto2" && edition !== "proto3")
        return {};
      var features = {};
      if (this.rule === "required" && (features.field_presence = "LEGACY_REQUIRED"), this.parent && types.defaults[this.type] === void 0) {
        var type = this.parent.get(this.type.split(".").pop());
        type && type instanceof Type && type.group && (features.message_encoding = "DELIMITED");
      }
      return this.getOption("packed") === !0 ? features.repeated_field_encoding = "PACKED" : this.getOption("packed") === !1 && (features.repeated_field_encoding = "EXPANDED"), features;
    };
    Field.prototype._resolveFeatures = function(edition) {
      return ReflectionObject.prototype._resolveFeatures.call(this, this._edition || edition);
    };
    Field.d = function(fieldId, fieldType, fieldRule, defaultValue) {
      return typeof fieldType == "function" ? fieldType = util2.decorateType(fieldType).name : fieldType && typeof fieldType == "object" && (fieldType = util2.decorateEnum(fieldType).name), function(prototype, fieldName) {
        util2.decorateType(prototype.constructor).add(new Field(fieldName, fieldId, fieldType, fieldRule, { default: defaultValue }));
      };
    };
    Field._configure = function(Type_) {
      Type = Type_;
    };
  }
});

// javascript/node_modules/protobufjs/src/oneof.js
var require_oneof = __commonJS({
  "javascript/node_modules/protobufjs/src/oneof.js"(exports, module) {
    "use strict";
    module.exports = OneOf;
    var ReflectionObject = require_object();
    OneOf.prototype = Object.create(ReflectionObject.prototype, {
      constructor: {
        value: OneOf,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    OneOf.className = "OneOf";
    var Field = require_field(), util2 = require_util();
    function OneOf(name, fieldNames, options, comment) {
      if (Array.isArray(fieldNames) || (options = fieldNames, fieldNames = void 0), ReflectionObject.call(this, name, options), !(fieldNames === void 0 || Array.isArray(fieldNames)))
        throw TypeError("fieldNames must be an Array");
      this.oneof = fieldNames || [], this.fieldsArray = [], this.comment = comment;
    }
    OneOf.fromJSON = function(name, json) {
      return new OneOf(name, json.oneof, json.options, json.comment);
    };
    OneOf.prototype.toJSON = function(toJSONOptions) {
      var keepComments = toJSONOptions ? !!toJSONOptions.keepComments : !1;
      return util2.toObject([
        "options",
        this.options,
        "oneof",
        this.oneof,
        "comment",
        keepComments ? this.comment : void 0
      ]);
    };
    function addFieldsToParent(oneof) {
      if (oneof.parent)
        for (var i = 0; i < oneof.fieldsArray.length; ++i)
          oneof.fieldsArray[i].parent || oneof.parent.add(oneof.fieldsArray[i]);
    }
    OneOf.prototype.add = function(field) {
      if (!(field instanceof Field))
        throw TypeError("field must be a Field");
      return field.parent && field.parent !== this.parent && field.parent.remove(field), this.oneof.push(field.name), this.fieldsArray.push(field), field.partOf = this, addFieldsToParent(this), this;
    };
    OneOf.prototype.remove = function(field) {
      if (!(field instanceof Field))
        throw TypeError("field must be a Field");
      var index = this.fieldsArray.indexOf(field);
      if (index < 0)
        throw Error(field + " is not a member of " + this);
      return this.fieldsArray.splice(index, 1), index = this.oneof.indexOf(field.name), index > -1 && this.oneof.splice(index, 1), field.partOf = null, this;
    };
    OneOf.prototype.onAdd = function(parent) {
      ReflectionObject.prototype.onAdd.call(this, parent);
      for (var self2 = this, i = 0; i < this.oneof.length; ++i) {
        var field = parent.get(this.oneof[i]);
        field && !field.partOf && (field.partOf = self2, self2.fieldsArray.push(field));
      }
      addFieldsToParent(this);
    };
    OneOf.prototype.onRemove = function(parent) {
      for (var i = 0, field; i < this.fieldsArray.length; ++i)
        (field = this.fieldsArray[i]).parent && field.parent.remove(field);
      ReflectionObject.prototype.onRemove.call(this, parent);
    };
    Object.defineProperty(OneOf.prototype, "isProto3Optional", {
      get: function() {
        if (this.fieldsArray == null || this.fieldsArray.length !== 1)
          return !1;
        var field = this.fieldsArray[0];
        return field.options != null && field.options.proto3_optional === !0;
      }
    });
    OneOf.d = function() {
      for (var fieldNames = new Array(arguments.length), index = 0; index < arguments.length; )
        fieldNames[index] = arguments[index++];
      return function(prototype, oneofName) {
        util2.decorateType(prototype.constructor).add(new OneOf(oneofName, fieldNames)), Object.defineProperty(prototype, oneofName, {
          get: util2.oneOfGetter(fieldNames),
          set: util2.oneOfSetter(fieldNames)
        });
      };
    };
  }
});

// javascript/node_modules/protobufjs/src/object.js
var require_object = __commonJS({
  "javascript/node_modules/protobufjs/src/object.js"(exports, module) {
    "use strict";
    module.exports = ReflectionObject;
    ReflectionObject.className = "ReflectionObject";
    var OneOf = require_oneof(), util2 = require_util(), Root, proto2Defaults = { enum_type: "CLOSED", field_presence: "EXPLICIT", json_format: "LEGACY_BEST_EFFORT", message_encoding: "LENGTH_PREFIXED", repeated_field_encoding: "EXPANDED", utf8_validation: "NONE", enforce_naming_style: "STYLE_LEGACY", default_symbol_visibility: "EXPORT_ALL" }, proto3Defaults = { enum_type: "OPEN", field_presence: "IMPLICIT", json_format: "ALLOW", message_encoding: "LENGTH_PREFIXED", repeated_field_encoding: "PACKED", utf8_validation: "VERIFY", enforce_naming_style: "STYLE_LEGACY", default_symbol_visibility: "EXPORT_ALL" }, editions2023Defaults = { enum_type: "OPEN", field_presence: "EXPLICIT", json_format: "ALLOW", message_encoding: "LENGTH_PREFIXED", repeated_field_encoding: "PACKED", utf8_validation: "VERIFY", enforce_naming_style: "STYLE_LEGACY", default_symbol_visibility: "EXPORT_ALL" }, editions2024Defaults = { enum_type: "OPEN", field_presence: "EXPLICIT", json_format: "ALLOW", message_encoding: "LENGTH_PREFIXED", repeated_field_encoding: "PACKED", utf8_validation: "VERIFY", enforce_naming_style: "STYLE2024", default_symbol_visibility: "EXPORT_TOP_LEVEL" }, editions2026Defaults = { enum_type: "OPEN", field_presence: "EXPLICIT", json_format: "ALLOW", message_encoding: "LENGTH_PREFIXED", repeated_field_encoding: "PACKED", utf8_validation: "VERIFY", enforce_naming_style: "STYLE2026", default_symbol_visibility: "STRICT", enforce_proto_limits: "PROTO_LIMITS2026" };
    function ReflectionObject(name, options) {
      if (!util2.isString(name))
        throw TypeError("name must be a string");
      if (options && !util2.isObject(options))
        throw TypeError("options must be an object");
      this.options = options, this.parsedOptions = null, this.name = name, this._edition = null, this._defaultEdition = "proto2", this._features = {}, this._featuresResolved = !1, this.parent = null, this.resolved = !1, this.comment = null, this.filename = null;
    }
    Object.defineProperties(ReflectionObject.prototype, {
      /**
       * Reference to the root namespace.
       * @name ReflectionObject#root
       * @type {Root}
       * @readonly
       */
      root: {
        get: function() {
          for (var ptr = this; ptr.parent !== null; )
            ptr = ptr.parent;
          return ptr;
        }
      },
      /**
       * Full name including leading dot.
       * @name ReflectionObject#fullName
       * @type {string}
       * @readonly
       */
      fullName: {
        get: function() {
          for (var path = [this.name], ptr = this.parent; ptr; )
            path.unshift(ptr.name), ptr = ptr.parent;
          return path.join(".");
        }
      }
    });
    ReflectionObject.prototype.toJSON = /* istanbul ignore next */
    function() {
      throw Error();
    };
    ReflectionObject.prototype.onAdd = function(parent) {
      this.parent && this.parent !== parent && this.parent.remove(this), this.parent = parent, this.resolved = !1;
      var root = parent.root;
      root instanceof Root && root._handleAdd(this);
    };
    ReflectionObject.prototype.onRemove = function(parent) {
      var root = parent.root;
      root instanceof Root && root._handleRemove(this), this.parent = null, this.resolved = !1;
    };
    ReflectionObject.prototype.resolve = function() {
      return this.resolved ? this : (this.root instanceof Root && (this.resolved = !0), this);
    };
    ReflectionObject.prototype._resolveFeaturesRecursive = function(edition) {
      return this._resolveFeatures(this._edition || edition);
    };
    ReflectionObject.prototype._resolveFeatures = function(edition) {
      if (!this._featuresResolved) {
        var defaults = {};
        if (!edition)
          throw new Error("Unknown edition for " + this.fullName);
        var protoFeatures = util2.merge(
          {},
          this.options && this.options.features,
          this._inferLegacyProtoFeatures(edition)
        );
        if (this._edition) {
          if (edition === "proto2")
            defaults = Object.assign({}, proto2Defaults);
          else if (edition === "proto3")
            defaults = Object.assign({}, proto3Defaults);
          else if (edition === "2023")
            defaults = Object.assign({}, editions2023Defaults);
          else if (edition === "2024")
            defaults = Object.assign({}, editions2024Defaults);
          else if (edition === "2026")
            defaults = Object.assign({}, editions2026Defaults);
          else
            throw new Error("Unknown edition: " + edition);
          this._features = util2.merge(defaults, protoFeatures);
        } else if (this.partOf instanceof OneOf) {
          var lexicalParentFeaturesCopy = util2.merge({}, this.partOf._features);
          this._features = util2.merge(lexicalParentFeaturesCopy, protoFeatures);
        } else if (!this.declaringField)
          if (this.parent) {
            var parentFeaturesCopy = util2.merge({}, this.parent._features);
            this._features = util2.merge(parentFeaturesCopy, protoFeatures);
          } else
            throw new Error("Unable to find a parent for " + this.fullName);
        this.extensionField && (this.extensionField._features = this._features), this._featuresResolved = !0;
      }
    };
    ReflectionObject.prototype._inferLegacyProtoFeatures = function() {
      return {};
    };
    ReflectionObject.prototype.getOption = function(name) {
      if (this.options && Object.prototype.hasOwnProperty.call(this.options, name))
        return this.options[name];
    };
    ReflectionObject.prototype.setOption = function(name, value, ifNotSet) {
      if (name === "__proto__")
        return this;
      if (this.options || (this.options = {}), /^features\./.test(name))
        util2.setProperty(this.options, name, value, ifNotSet);
      else {
        var prev = this.getOption(name);
        (!ifNotSet || prev === void 0) && (prev !== value && (this.resolved = !1), this.options[name] = value);
      }
      return this;
    };
    ReflectionObject.prototype.setParsedOption = function(name, value, propName) {
      if (name === "__proto__")
        return this;
      this.parsedOptions || (this.parsedOptions = []);
      var parsedOptions = this.parsedOptions;
      if (propName) {
        var opt = parsedOptions.find(function(opt2) {
          return Object.prototype.hasOwnProperty.call(opt2, name);
        });
        if (opt) {
          var newValue = opt[name];
          util2.setProperty(newValue, propName, value);
        } else
          opt = {}, opt[name] = util2.setProperty({}, propName, value), parsedOptions.push(opt);
      } else {
        var newOpt = {};
        newOpt[name] = value, parsedOptions.push(newOpt);
      }
      return this;
    };
    ReflectionObject.prototype.setOptions = function(options, ifNotSet) {
      if (options)
        for (var keys = Object.keys(options), i = 0; i < keys.length; ++i)
          this.setOption(keys[i], options[keys[i]], ifNotSet);
      return this;
    };
    Object.defineProperty(ReflectionObject.prototype, "toString", {
      value: function() {
        var className = this.constructor.className, fullName = this.fullName;
        return fullName.length ? className + " " + fullName : className;
      },
      writable: !0,
      enumerable: !1,
      configurable: !0
    });
    ReflectionObject.prototype._editionToJSON = function() {
      if (!(!this._edition || this._edition === "proto3"))
        return this._edition;
    };
    ReflectionObject._configure = function(Root_) {
      Root = Root_;
    };
  }
});

// javascript/node_modules/protobufjs/src/enum.js
var require_enum2 = __commonJS({
  "javascript/node_modules/protobufjs/src/enum.js"(exports, module) {
    "use strict";
    module.exports = Enum;
    var ReflectionObject = require_object();
    Enum.prototype = Object.create(ReflectionObject.prototype, {
      constructor: {
        value: Enum,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    Enum.className = "Enum";
    var Namespace = require_namespace(), util2 = require_util();
    function Enum(name, values, options, comment, comments, valuesOptions) {
      if (ReflectionObject.call(this, name, options), values && typeof values != "object")
        throw TypeError("values must be an object");
      if (this.valuesById = /* @__PURE__ */ Object.create(null), this.values = Object.create(this.valuesById), this.comment = comment, this.comments = comments || {}, this.valuesOptions = valuesOptions, this._valuesFeatures = {}, this.reserved = void 0, this.visibility = void 0, values)
        for (var keys = Object.keys(values), i = 0; i < keys.length; ++i)
          keys[i] !== "__proto__" && typeof values[keys[i]] == "number" && (this.values[keys[i]] = values[keys[i]], this.valuesById[values[keys[i]]] === void 0 && (this.valuesById[values[keys[i]]] = keys[i]));
    }
    Enum.prototype._resolveFeatures = function(edition) {
      return edition = this._edition || edition, ReflectionObject.prototype._resolveFeatures.call(this, edition), Object.keys(this.values).forEach((key) => {
        var parentFeaturesCopy = util2.merge({}, this._features);
        this._valuesFeatures[key] = util2.merge(parentFeaturesCopy, this.valuesOptions && this.valuesOptions[key] && this.valuesOptions[key].features || {});
      }), this;
    };
    Enum.fromJSON = function(name, json) {
      var enm = new Enum(name, json.values, json.options, json.comment, json.comments, json.valuesOptions);
      return enm.reserved = json.reserved, json.visibility && (enm.visibility = json.visibility), json.edition && (enm._edition = json.edition), enm._defaultEdition = "proto3", enm;
    };
    Enum.prototype.toJSON = function(toJSONOptions) {
      var keepComments = toJSONOptions ? !!toJSONOptions.keepComments : !1;
      return util2.toObject([
        "edition",
        this._editionToJSON(),
        "options",
        this.options,
        "valuesOptions",
        this.valuesOptions,
        "values",
        this.values,
        "reserved",
        this.reserved && this.reserved.length ? this.reserved : void 0,
        "visibility",
        this.visibility,
        "comment",
        keepComments ? this.comment : void 0,
        "comments",
        keepComments ? this.comments : void 0
      ]);
    };
    Enum.prototype.add = function(name, id, comment, options) {
      if (!util2.isString(name))
        throw TypeError("name must be a string");
      if (!util2.isInteger(id))
        throw TypeError("id must be an integer");
      if (name === "__proto__")
        return this;
      if (this.values[name] !== void 0)
        throw Error("duplicate name '" + name + "' in " + this);
      if (this.isReservedId(id))
        throw Error("id " + id + " is reserved in " + this);
      if (this.isReservedName(name))
        throw Error("name '" + name + "' is reserved in " + this);
      if (this.valuesById[id] !== void 0) {
        if (!(this.options && this.options.allow_alias))
          throw Error("duplicate id " + id + " in " + this);
        this.values[name] = id;
      } else
        this.valuesById[this.values[name] = id] = name;
      return options && (this.valuesOptions === void 0 && (this.valuesOptions = {}), this.valuesOptions[name] = options || null), this.comments[name] = comment || null, this;
    };
    Enum.prototype.remove = function(name) {
      if (!util2.isString(name))
        throw TypeError("name must be a string");
      var val = this.values[name];
      if (val == null)
        throw Error("name '" + name + "' does not exist in " + this);
      return delete this.valuesById[val], delete this.values[name], delete this.comments[name], this.valuesOptions && delete this.valuesOptions[name], this;
    };
    Enum.prototype.isReservedId = function(id) {
      return Namespace.isReservedId(this.reserved, id);
    };
    Enum.prototype.isReservedName = function(name) {
      return Namespace.isReservedName(this.reserved, name);
    };
  }
});

// javascript/node_modules/protobufjs/src/encoder.js
var require_encoder = __commonJS({
  "javascript/node_modules/protobufjs/src/encoder.js"(exports, module) {
    "use strict";
    module.exports = encoder;
    var Enum = require_enum2(), types = require_types3(), util2 = require_util();
    function genTypePartial(gen, field, fieldIndex, ref) {
      return field.delimited ? gen("types[%i].encode(%s,w.uint32(%i),q+1).uint32(%i)", fieldIndex, ref, (field.id << 3 | 3) >>> 0, (field.id << 3 | 4) >>> 0) : gen("types[%i].encode(%s,w.uint32(%i).fork(),q+1).ldelim()", fieldIndex, ref, (field.id << 3 | 2) >>> 0);
    }
    function encoder(mtype) {
      for (var gen = util2.codegen(["m", "w", "q"])("if(!w)")("w=Writer.create()")("if(q===undefined)q=0")("if(q>util.recursionLimit)")('throw Error("max depth exceeded")'), i, ref, fields = (
        /* initializes */
        mtype.fieldsArray.slice().sort(util2.compareFieldsById)
      ), i = 0; i < fields.length; ++i) {
        var field = fields[i].resolve(), index = mtype._fieldsArray.indexOf(field), type = field.resolvedType instanceof Enum ? "int32" : field.type, wireType = types.basic[type];
        ref = "m" + util2.safeProp(field.name), field.map ? (gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j)){", ref, field.name)("for(var ks=Object.keys(%s),i=0;i<ks.length;++i){", ref), field.keyType === "bool" ? gen("w.uint32(%i).fork().uint32(%i).bool(util.boolFromKey(ks[i]))", (field.id << 3 | 2) >>> 0, 8 | types.mapKey[field.keyType]) : types.long[field.keyType] !== void 0 ? gen("w.uint32(%i).fork().uint32(%i).%s(util.longFromKey(ks[i],%j))", (field.id << 3 | 2) >>> 0, 8 | types.mapKey[field.keyType], field.keyType, field.keyType === "uint64" || field.keyType === "fixed64") : gen("w.uint32(%i).fork().uint32(%i).%s(ks[i])", (field.id << 3 | 2) >>> 0, 8 | types.mapKey[field.keyType], field.keyType), wireType === void 0 ? gen("types[%i].encode(%s[ks[i]],w.uint32(18).fork(),q+1).ldelim().ldelim()", index, ref) : gen(".uint32(%i).%s(%s[ks[i]]).ldelim()", 16 | wireType, type, ref), gen("}")("}")) : field.repeated ? (gen("if(%s!=null&&%s.length){", ref, ref), field.packed && types.packed[type] !== void 0 ? gen("w.uint32(%i).%ss(%s)", (field.id << 3 | 2) >>> 0, type, ref) : (gen("for(var i=0;i<%s.length;++i)", ref), wireType === void 0 ? genTypePartial(gen, field, index, ref + "[i]") : gen("w.uint32(%i).%s(%s[i])", (field.id << 3 | wireType) >>> 0, type, ref)), gen("}")) : (field.required || (field.hasPresence || !(field.resolvedType instanceof Enum || types.basic[type] !== void 0) ? gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j))", ref, field.name) : field.resolvedType instanceof Enum ? gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&%s!==%j)", ref, field.name, ref, field.typeDefault) : type === "bool" ? gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&%s!==false)", ref, field.name, ref) : type === "string" ? gen('if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&%s!=="")', ref, field.name, ref) : type === "bytes" ? gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&%s.length)", ref, field.name, ref) : type === "double" || type === "float" ? gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&!Object.is(%s,0))", ref, field.name, ref) : types.long[type] !== void 0 ? gen('if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&(typeof %s==="object"?%s.low||%s.high:%s!==0))', ref, field.name, ref, ref, ref, ref) : gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&%s!==0)", ref, field.name, ref)), wireType === void 0 ? genTypePartial(gen, field, index, ref) : gen("w.uint32(%i).%s(%s)", (field.id << 3 | wireType) >>> 0, type, ref));
      }
      return gen('if(m.$unknowns!=null&&Object.hasOwnProperty.call(m,"$unknowns"))')("for(var i=0;i<m.$unknowns.length;++i)")("w.raw(m.$unknowns[i])")("return w");
    }
  }
});

// javascript/node_modules/protobufjs/src/index-light.js
var require_index_light = __commonJS({
  "javascript/node_modules/protobufjs/src/index-light.js"(exports, module) {
    "use strict";
    exports = module.exports = require_index_minimal();
    exports.build = "light";
    function load(filename, root, callback) {
      return typeof root == "function" ? (callback = root, root = new exports.Root()) : root || (root = new exports.Root()), root.load(filename, callback);
    }
    exports.load = load;
    function loadSync(filename, root) {
      return root || (root = new exports.Root()), root.loadSync(filename);
    }
    exports.loadSync = loadSync;
    exports.encoder = require_encoder();
    exports.decoder = require_decoder();
    exports.verifier = require_verifier();
    exports.converter = require_converter();
    exports.ReflectionObject = require_object();
    exports.Namespace = require_namespace();
    exports.Root = require_root();
    exports.Enum = require_enum2();
    exports.Type = require_type();
    exports.Field = require_field();
    exports.OneOf = require_oneof();
    exports.MapField = require_mapfield();
    exports.Service = require_service3();
    exports.Method = require_method();
    exports.Message = require_message3();
    exports.wrappers = require_wrappers2();
    exports.types = require_types3();
    exports.util = require_util();
    exports.ReflectionObject._configure(exports.Root);
    exports.Namespace._configure(exports.Type, exports.Service, exports.Enum);
    exports.Root._configure(exports.Type, void 0, {});
    exports.Field._configure(exports.Type);
  }
});

// javascript/node_modules/protobufjs/src/tokenize.js
var require_tokenize = __commonJS({
  "javascript/node_modules/protobufjs/src/tokenize.js"(exports, module) {
    "use strict";
    module.exports = tokenize;
    var delimRe = /[\s{}=;:[\],'"()<>]/g, stringDoubleRe = /(?:"([^"\\]*(?:\\.[^"\\]*)*)")/g, stringSingleRe = /(?:'([^'\\]*(?:\\.[^'\\]*)*)')/g, setCommentRe = /^ *[*/]+ */, setCommentAltRe = /^\s*\*?\/*/, setCommentSplitRe = /\n/g, whitespaceRe = /\s/, unescapeRe = /\\(.?)/g, unescapeMap = {
      0: "\0",
      r: "\r",
      n: `
`,
      t: "	"
    };
    function unescape(str) {
      return str.replace(unescapeRe, function($0, $1) {
        switch ($1) {
          case "\\":
          case "":
            return $1;
          default:
            return unescapeMap[$1] || "";
        }
      });
    }
    tokenize.unescape = unescape;
    function tokenize(source, alternateCommentMode) {
      source = source.toString();
      var offset = 0, length = source.length, line = 1, lastCommentLine = 0, comments = {}, stack = [], stringDelim = null;
      function illegal(subject) {
        return Error("illegal " + subject + " (line " + line + ")");
      }
      function readString() {
        var re = stringDelim === "'" ? stringSingleRe : stringDoubleRe;
        re.lastIndex = offset - 1;
        var match = re.exec(source);
        if (!match)
          throw illegal("string");
        return offset = re.lastIndex, push(stringDelim), stringDelim = null, unescape(match[1]);
      }
      function charAt(pos) {
        return source.charAt(pos);
      }
      function setComment(start, end, isLeading) {
        var comment = {
          type: source.charAt(start++),
          lineEmpty: !1,
          leading: isLeading
        }, lookback;
        alternateCommentMode ? lookback = 2 : lookback = 3;
        var commentOffset = start - lookback, c;
        do
          if (--commentOffset < 0 || (c = source.charAt(commentOffset)) === `
`) {
            comment.lineEmpty = !0;
            break;
          }
        while (c === " " || c === "	");
        for (var lines = source.substring(start, end).split(setCommentSplitRe), i = 0; i < lines.length; ++i)
          lines[i] = lines[i].replace(alternateCommentMode ? setCommentAltRe : setCommentRe, "").trim();
        comment.text = lines.join(`
`).trim(), comments[line] = comment, lastCommentLine = line;
      }
      function isDoubleSlashCommentLine(startOffset) {
        var endOffset = findEndOfLine(startOffset), lineText = source.substring(startOffset, endOffset), isComment = /^\s*\/\//.test(lineText);
        return isComment;
      }
      function findEndOfLine(cursor) {
        for (var endOffset = cursor; endOffset < length && charAt(endOffset) !== `
`; )
          endOffset++;
        return endOffset;
      }
      function next() {
        if (stack.length > 0)
          return stack.shift();
        if (stringDelim)
          return readString();
        var repeat, prev, curr, start, isDoc, nextLineIsComment, isLeadingComment = offset === 0;
        do {
          if (offset === length)
            return null;
          for (repeat = !1; whitespaceRe.test(curr = charAt(offset)); )
            if (curr === `
` && (isLeadingComment = !0, ++line), ++offset === length)
              return null;
          if (charAt(offset) === "/") {
            if (++offset === length)
              throw illegal("comment");
            if (charAt(offset) === "/")
              if (alternateCommentMode) {
                if (start = offset, isDoc = !1, isDoubleSlashCommentLine(offset - 1)) {
                  isDoc = !0;
                  do {
                    if (offset = findEndOfLine(offset), offset === length || (offset++, !isLeadingComment))
                      break;
                    nextLineIsComment = isDoubleSlashCommentLine(offset), nextLineIsComment && line++;
                  } while (nextLineIsComment);
                } else
                  offset = Math.min(length, findEndOfLine(offset) + 1);
                isDoc && (setComment(start, offset, isLeadingComment), isLeadingComment = !0), line++, repeat = !0;
              } else {
                for (isDoc = charAt(start = offset + 1) === "/"; charAt(++offset) !== `
`; )
                  if (offset === length)
                    return null;
                ++offset, isDoc && (setComment(start, offset - 1, isLeadingComment), isLeadingComment = !0), ++line, repeat = !0;
              }
            else if ((curr = charAt(offset)) === "*") {
              start = offset + 1, isDoc = alternateCommentMode || charAt(start) === "*";
              do {
                if (curr === `
` && ++line, ++offset === length)
                  throw illegal("comment");
                prev = curr, curr = charAt(offset);
              } while (prev !== "*" || curr !== "/");
              ++offset, isDoc && (setComment(start, offset - 2, isLeadingComment), isLeadingComment = !0), repeat = !0;
            } else
              return "/";
          }
        } while (repeat);
        var end = offset;
        delimRe.lastIndex = 0;
        var delim = delimRe.test(charAt(end++));
        if (!delim)
          for (; end < length && !delimRe.test(charAt(end)); )
            ++end;
        var token = source.substring(offset, offset = end);
        return (token === '"' || token === "'") && (stringDelim = token), token;
      }
      function push(token) {
        stack.push(token);
      }
      function peek() {
        if (!stack.length) {
          var token = next();
          if (token === null)
            return null;
          push(token);
        }
        return stack[0];
      }
      function skip(expected, optional) {
        var actual = peek(), equals2 = actual === expected;
        if (equals2)
          return next(), !0;
        if (!optional)
          throw illegal("token '" + actual + "', '" + expected + "' expected");
        return !1;
      }
      function cmnt(trailingLine) {
        var ret = null, comment;
        return trailingLine === void 0 ? (comment = comments[line - 1], delete comments[line - 1], comment && (alternateCommentMode || comment.type === "*" || comment.lineEmpty) && (ret = comment.leading ? comment.text : null)) : (lastCommentLine < trailingLine && peek(), comment = comments[trailingLine], delete comments[trailingLine], comment && !comment.lineEmpty && (alternateCommentMode || comment.type === "/") && (ret = comment.leading ? null : comment.text)), ret;
      }
      return Object.defineProperty({
        next,
        peek,
        push,
        skip,
        cmnt
      }, "line", {
        get: function() {
          return line;
        }
      });
    }
  }
});

// javascript/node_modules/protobufjs/src/parse.js
var require_parse = __commonJS({
  "javascript/node_modules/protobufjs/src/parse.js"(exports, module) {
    "use strict";
    module.exports = parse2;
    parse2.filename = null;
    parse2.defaults = { keepCase: !1 };
    var tokenize = require_tokenize(), Root = require_root(), Type = require_type(), Field = require_field(), MapField = require_mapfield(), OneOf = require_oneof(), Enum = require_enum2(), Service = require_service3(), Method = require_method(), ReflectionObject = require_object(), types = require_types3(), util2 = require_util(), base10Re = /^[1-9][0-9]*$/, base10NegRe = /^-?[1-9][0-9]*$/, base16Re = /^0[x][0-9a-fA-F]+$/, base16NegRe = /^-?0[x][0-9a-fA-F]+$/, base8Re = /^0[0-7]+$/, base8NegRe = /^-?0[0-7]+$/, integerTypeRe = /^(?:u?int|sint|s?fixed)(?:32|64)$/, unsignedTypeRe = /^(?:uint|fixed)(?:32|64)$/, numberRe = util2.patterns.numberRe, nameRe = /^[a-zA-Z_][a-zA-Z_0-9]*$/, typeRefRe = util2.patterns.typeRefRe, maxFieldId = 536870911, maxEnumId = 2147483647;
    function parse2(source, root, options) {
      root instanceof Root || (options = root, root = new Root()), options || (options = parse2.defaults);
      var preferTrailingComment = options.preferTrailingComment || !1, tn = tokenize(source, options.alternateCommentMode || !1), next = tn.next, push = tn.push, peek = tn.peek, skip = tn.skip, cmnt = tn.cmnt, head = !0, pkg, imports, weakImports, edition = "proto2", ptr = root, topLevelObjects = [], topLevelOptions = {}, applyCase = options.keepCase ? function(name) {
        return name;
      } : util2.camelCase;
      function resolveFileFeatures() {
        topLevelObjects.forEach((obj) => {
          obj._edition = edition, Object.keys(topLevelOptions).forEach((opt) => {
            obj.getOption(opt) === void 0 && obj.setOption(opt, topLevelOptions[opt], !0);
          });
        });
      }
      function illegal(token2, name, insideTryCatch) {
        var filename = parse2.filename;
        return insideTryCatch || (parse2.filename = null), Error("illegal " + (name || "token") + " '" + token2 + "' (" + (filename ? filename + ", " : "") + "line " + tn.line + ")");
      }
      function readString() {
        var values = [], token2;
        do {
          if ((token2 = next()) !== '"' && token2 !== "'")
            throw illegal(token2);
          values.push(next()), skip(token2), token2 = peek();
        } while (token2 === '"' || token2 === "'");
        return values.join("");
      }
      function readValue(acceptTypeRef) {
        var token2 = next();
        switch (token2) {
          case "'":
          case '"':
            return push(token2), readString();
          case "true":
          case "TRUE":
            return !0;
          case "false":
          case "FALSE":
            return !1;
        }
        try {
          return parseNumber(
            token2,
            /* insideTryCatch */
            !0
          );
        } catch {
          if (acceptTypeRef && typeRefRe.test(token2))
            return token2;
          throw illegal(token2, "value");
        }
      }
      function readRanges(target, acceptStrings, max, acceptNegative) {
        var token2, start;
        do
          if (acceptStrings && ((token2 = peek()) === '"' || token2 === "'")) {
            var str = readString();
            if (target.push(str), edition >= 2023)
              throw illegal(str, "id");
          } else
            try {
              target.push([start = parseId(next(), acceptNegative, max), skip("to", !0) ? parseId(next(), acceptNegative, max) : start]);
            } catch (err) {
              if (acceptStrings && typeRefRe.test(token2) && edition >= 2023)
                target.push(token2);
              else
                throw err;
            }
        while (skip(",", !0));
        var dummy = { options: void 0 };
        dummy.setOption = function(name, value) {
          this.options === void 0 && (this.options = {}), this.options[name] = value;
        }, ifBlock(
          dummy,
          function(token3) {
            if (token3 === "option")
              parseOption(dummy, token3), skip(";");
            else
              throw illegal(token3);
          },
          function() {
            parseInlineOptions(dummy);
          }
        );
      }
      function parseNumber(token2, insideTryCatch) {
        var sign = 1;
        switch (token2.charAt(0) === "-" && (sign = -1, token2 = token2.substring(1)), token2) {
          case "inf":
          case "INF":
          case "Inf":
            return sign * (1 / 0);
          case "nan":
          case "NAN":
          case "Nan":
          case "NaN":
            return NaN;
          case "0":
            return sign * 0;
        }
        if (base10Re.test(token2))
          return sign * parseInt(token2, 10);
        if (base16Re.test(token2))
          return sign * parseInt(token2, 16);
        if (base8Re.test(token2))
          return sign * parseInt(token2, 8);
        if (numberRe.test(token2))
          return sign * parseFloat(token2);
        throw illegal(token2, "number", insideTryCatch);
      }
      function parseInteger(token2, acceptNegative, name) {
        if (token2 === null)
          throw illegal(token2, "end of input");
        if (!acceptNegative && token2.charAt(0) === "-")
          throw illegal(token2, name || "integer");
        if (token2 === "0" || token2 === "-0")
          return 0;
        var value;
        if (base10NegRe.test(token2))
          value = parseInt(token2, 10);
        else if (base16NegRe.test(token2))
          value = parseInt(token2, 16);
        else if (base8NegRe.test(token2))
          value = parseInt(token2, 8);
        else
          throw illegal(token2, name || "integer");
        return value || 0;
      }
      function parseId(token2, acceptNegative, max) {
        switch (token2) {
          case "max":
          case "MAX":
          case "Max":
            return max || maxFieldId;
        }
        return parseInteger(token2, acceptNegative, "id");
      }
      function parsePackage() {
        if (pkg !== void 0)
          throw illegal("package");
        if (pkg = next(), pkg === null || !typeRefRe.test(pkg))
          throw illegal(pkg, "name");
        ptr = ptr.define(pkg), skip(";");
      }
      function parseImport() {
        var token2 = peek(), whichImports;
        switch (token2) {
          case "option":
            if (edition < "2024")
              throw illegal("option");
            next(), readString(), skip(";");
            return;
          case "weak":
            whichImports = weakImports || (weakImports = []), next();
            break;
          case "public":
            next();
          // eslint-disable-next-line no-fallthrough
          default:
            whichImports = imports || (imports = []);
            break;
        }
        token2 = readString(), skip(";"), whichImports.push(token2);
      }
      function parseSyntax() {
        if (skip("="), edition = readString(), edition < 2023)
          throw illegal(edition, "syntax");
        skip(";");
      }
      function parseEdition() {
        if (skip("="), edition = readString(), !["2023", "2024", "2026"].includes(edition))
          throw illegal(edition, "edition");
        skip(";");
      }
      function parseCommon(parent, token2, depth) {
        switch (depth === void 0 && (depth = 0), token2) {
          case "option":
            return parseOption(parent, token2), skip(";"), !0;
          case "message":
            return parseType(parent, token2, depth + 1), !0;
          case "enum":
            return parseEnum(parent, token2), !0;
          case "export":
          case "local":
            if (edition < "2024")
              return !1;
            var visibility = token2;
            return token2 = next(), token2 === "export" || token2 === "local" || token2 !== "message" && token2 !== "enum" ? !1 : ((token2 === "message" ? parseType(parent, token2, depth + 1) : parseEnum(parent, token2)).visibility = visibility, !0);
          case "service":
            return parseService(parent, token2, depth + 1), !0;
          case "extend":
            return parseExtension(parent, token2, depth), !0;
        }
        return !1;
      }
      function ifBlock(obj, fnIf, fnElse) {
        var trailingLine = tn.line;
        if (obj && (typeof obj.comment != "string" && (obj.comment = cmnt()), obj.filename = parse2.filename), skip("{", !0)) {
          for (var token2; (token2 = next()) !== "}"; )
            fnIf(token2);
          skip(";", !0);
        } else
          fnElse && fnElse(), skip(";"), obj && (typeof obj.comment != "string" || preferTrailingComment) && (obj.comment = cmnt(trailingLine) || obj.comment);
      }
      function parseType(parent, token2, depth) {
        if (depth === void 0 && (depth = 0), depth > util2.nestingLimit)
          throw Error("max depth exceeded");
        if ((token2 = next()) === null || !nameRe.test(token2))
          throw illegal(token2, "type name");
        var type = new Type(token2);
        return ifBlock(type, function(token3) {
          if (!parseCommon(type, token3, depth))
            switch (token3) {
              case ";":
                break;
              case "map":
                parseMapField(type, token3);
                break;
              case "required":
                if (edition !== "proto2")
                  throw illegal(token3);
              /* eslint-disable no-fallthrough */
              case "repeated":
                parseField(type, token3, void 0, depth + 1);
                break;
              case "optional":
                if (edition === "proto3")
                  parseField(type, "proto3_optional", void 0, depth + 1);
                else {
                  if (edition !== "proto2")
                    throw illegal(token3);
                  parseField(type, "optional", void 0, depth + 1);
                }
                break;
              case "oneof":
                parseOneOf(type, token3, depth + 1);
                break;
              case "extensions":
                readRanges(type.extensions || (type.extensions = []));
                break;
              case "reserved":
                readRanges(type.reserved || (type.reserved = []), !0);
                break;
              default:
                if (edition === "proto2" || !typeRefRe.test(token3))
                  throw illegal(token3);
                push(token3), parseField(type, "optional", void 0, depth + 1);
                break;
            }
        }), parent.add(type), parent === ptr && topLevelObjects.push(type), type;
      }
      function parseField(parent, rule, extend, depth) {
        var type = next();
        if (type === null)
          throw illegal(type, "end of input");
        if (type === "group") {
          parseGroup(parent, rule, extend, depth);
          return;
        }
        for (; type.endsWith(".") || (peek() || "").startsWith("."); ) {
          var part = next();
          if (part === null)
            throw illegal(part, "end of input");
          type += part;
        }
        if (!typeRefRe.test(type))
          throw illegal(type, "type");
        var name = next();
        if (name === null)
          throw illegal(name, "end of input");
        if (!nameRe.test(name))
          throw illegal(name, "name");
        var protoName = name;
        name = applyCase(name), skip("=");
        var field = new Field(name, parseId(next()), type, rule === "proto3_optional" ? "optional" : rule, extend);
        if (protoName !== name && (field.protoName = protoName), ifBlock(field, function(token2) {
          if (token2 === "option")
            parseOption(field, token2), skip(";");
          else
            throw illegal(token2);
        }, function() {
          parseInlineOptions(field);
        }), rule === "proto3_optional") {
          var oneof = new OneOf("_" + name);
          field.setOption("proto3_optional", !0), oneof.add(field), parent.add(oneof);
        } else
          parent.add(field);
        parent === ptr && topLevelObjects.push(field);
      }
      function parseGroup(parent, rule, extend, depth) {
        if (depth === void 0 && (depth = 0), depth > util2.nestingLimit)
          throw Error("max depth exceeded");
        if (edition >= 2023)
          throw illegal("group");
        var name = next();
        if (name === null || !nameRe.test(name))
          throw illegal(name, "name");
        var fieldName = util2.lcFirst(name);
        name === fieldName && (name = util2.ucFirst(name)), skip("=");
        var id = parseId(next()), type = new Type(name);
        type.group = !0;
        var field = new Field(fieldName, id, name, rule, extend);
        field.filename = parse2.filename, ifBlock(type, function(token2) {
          switch (token2) {
            case ";":
              break;
            case "map":
              parseMapField(type);
              break;
            case "option":
              parseOption(type, token2), skip(";");
              break;
            case "required":
            case "repeated":
              parseField(type, token2, void 0, depth + 1);
              break;
            case "optional":
              edition === "proto3" ? parseField(type, "proto3_optional", void 0, depth + 1) : parseField(type, "optional", void 0, depth + 1);
              break;
            case "message":
              parseType(type, token2, depth + 1);
              break;
            case "enum":
              parseEnum(type, token2);
              break;
            case "reserved":
              readRanges(type.reserved || (type.reserved = []), !0);
              break;
            case "export":
            case "local":
              if (edition < "2024")
                throw illegal(token2);
              switch (token2 = next(), token2) {
                case "message":
                  parseType(type, token2, depth + 1);
                  break;
                case "enum":
                  parseType(type, token2, depth + 1);
                  break;
                default:
                  throw illegal(token2);
              }
              break;
            /* istanbul ignore next */
            default:
              throw illegal(token2);
          }
        }), parent.add(type).add(field), parent === ptr && (topLevelObjects.push(type), topLevelObjects.push(field));
      }
      function parseMapField(parent) {
        skip("<");
        var keyType = next();
        if (types.mapKey[keyType] === void 0)
          throw illegal(keyType, "type");
        skip(",");
        var valueType = next();
        if (!typeRefRe.test(valueType))
          throw illegal(valueType, "type");
        skip(">");
        var name = next();
        if (name === null || !nameRe.test(name))
          throw illegal(name, "name");
        skip("=");
        var protoName = name;
        name = applyCase(name);
        var field = new MapField(name, parseId(next()), keyType, valueType);
        protoName !== name && (field.protoName = protoName), ifBlock(field, function(token2) {
          if (token2 === "option")
            parseOption(field, token2), skip(";");
          else
            throw illegal(token2);
        }, function() {
          parseInlineOptions(field);
        }), parent.add(field);
      }
      function parseOneOf(parent, token2, depth) {
        if ((token2 = next()) === null || !nameRe.test(token2))
          throw illegal(token2, "name");
        var oneof = new OneOf(applyCase(token2));
        ifBlock(oneof, function(token3) {
          token3 === "option" ? (parseOption(oneof, token3), skip(";")) : (push(token3), parseField(oneof, "optional", void 0, depth));
        }), parent.add(oneof);
      }
      function parseEnum(parent, token2) {
        if ((token2 = next()) === null || !nameRe.test(token2))
          throw illegal(token2, "name");
        var enm = new Enum(token2), values = [];
        ifBlock(enm, function(token3) {
          switch (token3) {
            case ";":
              break;
            case "option":
              parseOption(enm, token3), skip(";");
              break;
            case "reserved":
              readRanges(enm.reserved || (enm.reserved = []), !0, maxEnumId, !0), enm.reserved === void 0 && (enm.reserved = []);
              break;
            default:
              values.push(parseEnumValue(token3));
          }
        });
        for (var i = 0; i < values.length; ++i)
          enm.add(values[i].name, values[i].id, values[i].comment, values[i].options);
        return parent.add(enm), parent === ptr && topLevelObjects.push(enm), enm;
      }
      function parseEnumValue(token2) {
        if (!nameRe.test(token2))
          throw illegal(token2, "name");
        skip("=");
        var value = parseId(next(), !0), dummy = {
          options: void 0
        };
        return dummy.getOption = function(name) {
          return this.options[name];
        }, dummy.setOption = function(name, value2) {
          ReflectionObject.prototype.setOption.call(dummy, name, value2);
        }, dummy.setParsedOption = function() {
        }, ifBlock(dummy, function(token3) {
          if (token3 === "option")
            parseOption(dummy, token3), skip(";");
          else
            throw illegal(token3);
        }, function() {
          parseInlineOptions(dummy);
        }), {
          name: token2,
          id: value,
          comment: dummy.comment,
          options: dummy.parsedOptions || dummy.options
        };
      }
      function parseOption(parent, token2) {
        var option, propName, isOption = !0;
        for (token2 === "option" && (token2 = next()); token2 !== "="; ) {
          if (token2 === null)
            throw illegal(token2, "end of input");
          if (token2 === "(") {
            var parensValue = next();
            skip(")"), token2 = "(" + parensValue + ")";
          }
          if (isOption) {
            if (isOption = !1, token2.includes(".") && !token2.includes("(")) {
              var tokens = token2.split(".");
              option = tokens[0] + ".", token2 = tokens[1];
              continue;
            }
            option = token2;
          } else
            propName = propName ? propName += token2 : token2;
          token2 = next();
        }
        var name = propName ? option.concat(propName) : option, optionValue = parseOptionValue(parent, name);
        propName = propName && propName[0] === "." ? propName.slice(1) : propName, option = option && option[option.length - 1] === "." ? option.slice(0, -1) : option, setParsedOption(parent, option, optionValue, propName);
      }
      function parseOptionValue(parent, name, depth) {
        if (depth === void 0 && (depth = 0), depth > util2.recursionLimit)
          throw Error("max depth exceeded");
        if (skip("{", !0)) {
          for (var objectResult = {}; !skip("}", !0); ) {
            token = next();
            var propName;
            if (token === null)
              throw illegal(token, "end of input");
            if (token === "[") {
              token = next();
              var slash = token === null ? -1 : token.lastIndexOf("/");
              if (token === null || !typeRefRe.test(slash < 0 ? token : token.slice(slash + 1)))
                throw illegal(token, "name");
              propName = "[" + token + "]", skip("]");
            } else {
              if (!nameRe.test(token))
                throw illegal(token, "name");
              propName = token;
            }
            var value;
            if (skip(":", !0), peek() === "{")
              value = parseOptionValue(parent, name + "." + propName, depth + 1);
            else if (peek() === "[") {
              value = [];
              var lastValue, lastValueIsAggregate;
              if (skip("[", !0) && !skip("]", !0)) {
                do
                  lastValueIsAggregate = peek() === "{", lastValue = lastValueIsAggregate ? parseOptionValue(parent, name + "." + propName, depth + 1) : readValue(!0), value.push(lastValue);
                while (skip(",", !0));
                skip("]"), typeof lastValue < "u" && (lastValueIsAggregate || setOption(parent, name + "." + propName, lastValue));
              }
            } else
              value = readValue(!0), setOption(parent, name + "." + propName, value);
            var prevValue = Object.prototype.hasOwnProperty.call(objectResult, propName) ? objectResult[propName] : void 0;
            prevValue && (value = [].concat(prevValue).concat(value)), propName !== "__proto__" && (objectResult[propName] = value), skip(",", !0), skip(";", !0);
          }
          return objectResult;
        }
        var simpleValue = name === "default" && parent instanceof Field && integerTypeRe.test(parent.type) ? parseInteger(next(), !unsignedTypeRe.test(parent.type)) : readValue(!0);
        return setOption(parent, name, simpleValue), simpleValue;
      }
      function setOption(parent, name, value) {
        if (ptr === parent && /^features\./.test(name)) {
          topLevelOptions[name] = value;
          return;
        }
        name === "json_name" && parent instanceof Field && (parent.jsonName = value), parent.setOption && parent.setOption(name, value);
      }
      function setParsedOption(parent, name, value, propName) {
        parent.setParsedOption && parent.setParsedOption(name, value, propName);
      }
      function parseInlineOptions(parent) {
        if (skip("[", !0)) {
          do
            parseOption(parent, "option");
          while (skip(",", !0));
          skip("]");
        }
        return parent;
      }
      function parseService(parent, token2, depth) {
        if (depth === void 0 && (depth = 0), depth > util2.recursionLimit)
          throw Error("max depth exceeded");
        if ((token2 = next()) === null || !nameRe.test(token2))
          throw illegal(token2, "service name");
        var service = new Service(token2);
        ifBlock(service, function(token3) {
          if (!parseCommon(service, token3, depth) && token3 !== ";")
            if (token3 === "rpc")
              parseMethod(service, token3);
            else
              throw illegal(token3);
        }), parent.add(service), parent === ptr && topLevelObjects.push(service);
      }
      function parseMethod(parent, token2) {
        var commentText = cmnt(), type = token2;
        if (!nameRe.test(token2 = next()))
          throw illegal(token2, "name");
        var name = token2, requestType, requestStream, responseType, responseStream;
        if (skip("("), skip("stream", !0) && (requestStream = !0), !typeRefRe.test(token2 = next()) || (requestType = token2, skip(")"), skip("returns"), skip("("), skip("stream", !0) && (responseStream = !0), !typeRefRe.test(token2 = next())))
          throw illegal(token2);
        responseType = token2, skip(")");
        var method = new Method(name, type, requestType, responseType, requestStream, responseStream);
        method.comment = commentText, ifBlock(method, function(token3) {
          if (token3 !== ";")
            if (token3 === "option")
              parseOption(method, token3), skip(";");
            else
              throw illegal(token3);
        }), parent.add(method);
      }
      function parseExtension(parent, token2, depth) {
        if ((token2 = next()) === null || !typeRefRe.test(token2))
          throw illegal(token2, "reference");
        var reference = token2;
        ifBlock(null, function(token3) {
          switch (token3) {
            case "required":
            case "repeated":
              parseField(parent, token3, reference, depth + 1);
              break;
            case "optional":
              edition === "proto3" ? parseField(parent, "proto3_optional", reference, depth + 1) : parseField(parent, "optional", reference, depth + 1);
              break;
            default:
              if (edition === "proto2" || !typeRefRe.test(token3))
                throw illegal(token3);
              push(token3), parseField(parent, "optional", reference, depth + 1);
              break;
          }
        });
      }
      for (var token; (token = next()) !== null; )
        switch (token) {
          case ";":
            break;
          case "package":
            if (!head)
              throw illegal(token);
            parsePackage();
            break;
          case "import":
            parseImport();
            break;
          case "syntax":
            if (!head)
              throw illegal(token);
            parseSyntax();
            break;
          case "edition":
            if (!head)
              throw illegal(token);
            parseEdition();
            break;
          case "option":
            parseOption(ptr, token), skip(";", !0);
            break;
          default:
            if (parseCommon(ptr, token, 0)) {
              head = !1;
              continue;
            }
            throw illegal(token);
        }
      return resolveFileFeatures(), parse2.filename = null, {
        package: pkg,
        imports,
        weakImports,
        root
      };
    }
  }
});

// javascript/node_modules/protobufjs/src/common.js
var require_common = __commonJS({
  "javascript/node_modules/protobufjs/src/common.js"(exports, module) {
    "use strict";
    module.exports = common;
    var commonRe = /\/|\./;
    function common(name, json) {
      commonRe.test(name) || (name = "google/protobuf/" + name + ".proto", json = { nested: { google: { nested: { protobuf: { nested: json } } } } }), common[name] = json;
    }
    common("any", {
      /**
       * Properties of a google.protobuf.Any message.
       * @interface IAny
       * @type {Object}
       * @property {string} [typeUrl]
       * @property {Uint8Array} [bytes]
       * @memberof common
       */
      Any: {
        fields: {
          type_url: {
            type: "string",
            id: 1
          },
          value: {
            type: "bytes",
            id: 2
          }
        }
      }
    });
    var timeType;
    common("duration", {
      /**
       * Properties of a google.protobuf.Duration message.
       * @interface IDuration
       * @type {Object}
       * @property {number|Long} [seconds]
       * @property {number} [nanos]
       * @memberof common
       */
      Duration: timeType = {
        fields: {
          seconds: {
            type: "int64",
            id: 1
          },
          nanos: {
            type: "int32",
            id: 2
          }
        }
      }
    });
    common("timestamp", {
      /**
       * Properties of a google.protobuf.Timestamp message.
       * @interface ITimestamp
       * @type {Object}
       * @property {number|Long} [seconds]
       * @property {number} [nanos]
       * @memberof common
       */
      Timestamp: timeType
    });
    common("empty", {
      /**
       * Properties of a google.protobuf.Empty message.
       * @interface IEmpty
       * @memberof common
       */
      Empty: {
        fields: {}
      }
    });
    common("struct", {
      /**
       * Properties of a google.protobuf.Struct message.
       * @interface IStruct
       * @type {Object}
       * @property {Object.<string,IValue>} [fields]
       * @memberof common
       */
      Struct: {
        fields: {
          fields: {
            keyType: "string",
            type: "Value",
            id: 1
          }
        }
      },
      /**
       * Properties of a google.protobuf.Value message.
       * @interface IValue
       * @type {Object}
       * @property {string} [kind]
       * @property {0} [nullValue]
       * @property {number} [numberValue]
       * @property {string} [stringValue]
       * @property {boolean} [boolValue]
       * @property {IStruct} [structValue]
       * @property {IListValue} [listValue]
       * @memberof common
       */
      Value: {
        oneofs: {
          kind: {
            oneof: [
              "nullValue",
              "numberValue",
              "stringValue",
              "boolValue",
              "structValue",
              "listValue"
            ]
          }
        },
        fields: {
          nullValue: {
            type: "NullValue",
            id: 1,
            protoName: "null_value"
          },
          numberValue: {
            type: "double",
            id: 2,
            protoName: "number_value"
          },
          stringValue: {
            type: "string",
            id: 3,
            protoName: "string_value"
          },
          boolValue: {
            type: "bool",
            id: 4,
            protoName: "bool_value"
          },
          structValue: {
            type: "Struct",
            id: 5,
            protoName: "struct_value"
          },
          listValue: {
            type: "ListValue",
            id: 6,
            protoName: "list_value"
          }
        }
      },
      NullValue: {
        values: {
          NULL_VALUE: 0
        }
      },
      /**
       * Properties of a google.protobuf.ListValue message.
       * @interface IListValue
       * @type {Object}
       * @property {Array.<IValue>} [values]
       * @memberof common
       */
      ListValue: {
        fields: {
          values: {
            rule: "repeated",
            type: "Value",
            id: 1
          }
        }
      }
    });
    common("wrappers", {
      /**
       * Properties of a google.protobuf.DoubleValue message.
       * @interface IDoubleValue
       * @type {Object}
       * @property {number} [value]
       * @memberof common
       */
      DoubleValue: {
        fields: {
          value: {
            type: "double",
            id: 1
          }
        }
      },
      /**
       * Properties of a google.protobuf.FloatValue message.
       * @interface IFloatValue
       * @type {Object}
       * @property {number} [value]
       * @memberof common
       */
      FloatValue: {
        fields: {
          value: {
            type: "float",
            id: 1
          }
        }
      },
      /**
       * Properties of a google.protobuf.Int64Value message.
       * @interface IInt64Value
       * @type {Object}
       * @property {number|Long} [value]
       * @memberof common
       */
      Int64Value: {
        fields: {
          value: {
            type: "int64",
            id: 1
          }
        }
      },
      /**
       * Properties of a google.protobuf.UInt64Value message.
       * @interface IUInt64Value
       * @type {Object}
       * @property {number|Long} [value]
       * @memberof common
       */
      UInt64Value: {
        fields: {
          value: {
            type: "uint64",
            id: 1
          }
        }
      },
      /**
       * Properties of a google.protobuf.Int32Value message.
       * @interface IInt32Value
       * @type {Object}
       * @property {number} [value]
       * @memberof common
       */
      Int32Value: {
        fields: {
          value: {
            type: "int32",
            id: 1
          }
        }
      },
      /**
       * Properties of a google.protobuf.UInt32Value message.
       * @interface IUInt32Value
       * @type {Object}
       * @property {number} [value]
       * @memberof common
       */
      UInt32Value: {
        fields: {
          value: {
            type: "uint32",
            id: 1
          }
        }
      },
      /**
       * Properties of a google.protobuf.BoolValue message.
       * @interface IBoolValue
       * @type {Object}
       * @property {boolean} [value]
       * @memberof common
       */
      BoolValue: {
        fields: {
          value: {
            type: "bool",
            id: 1
          }
        }
      },
      /**
       * Properties of a google.protobuf.StringValue message.
       * @interface IStringValue
       * @type {Object}
       * @property {string} [value]
       * @memberof common
       */
      StringValue: {
        fields: {
          value: {
            type: "string",
            id: 1
          }
        }
      },
      /**
       * Properties of a google.protobuf.BytesValue message.
       * @interface IBytesValue
       * @type {Object}
       * @property {Uint8Array} [value]
       * @memberof common
       */
      BytesValue: {
        fields: {
          value: {
            type: "bytes",
            id: 1
          }
        }
      }
    });
    common("field_mask", {
      /**
       * Properties of a google.protobuf.FieldMask message.
       * @interface IFieldMask
       * @type {Object}
       * @property {string[]} [paths]
       * @memberof common
       */
      FieldMask: {
        fields: {
          paths: {
            rule: "repeated",
            type: "string",
            id: 1
          }
        }
      }
    });
    common.get = function(file) {
      return common[file] || null;
    };
  }
});

// javascript/node_modules/protobufjs/src/index.js
var require_src = __commonJS({
  "javascript/node_modules/protobufjs/src/index.js"(exports, module) {
    "use strict";
    exports = module.exports = require_index_light();
    exports.build = "full";
    exports.tokenize = require_tokenize();
    exports.parse = require_parse();
    exports.common = require_common();
    exports.Root._configure(exports.Type, exports.parse, exports.common);
  }
});

// javascript/node_modules/protobufjs/index.js
var require_protobufjs = __commonJS({
  "javascript/node_modules/protobufjs/index.js"(exports, module) {
    "use strict";
    module.exports = require_src();
  }
});

// javascript/lib/cp_sat/protocol.ts
var import_protobuf = __toESM(require_commonjs(), 1);

// javascript/lib/generated/bridge/cp_sat_pb.ts
var import_codegenv2 = __toESM(require_codegenv2(), 1), file_cp_sat = /* @__PURE__ */ (0, import_codegenv2.fileDesc)("CgxjcF9zYXQucHJvdG8SFm9ydG9vbHNfd2FzbS5icmlkZ2UudjEinQEKEkNwU2F0QnJpZGdlUmVxdWVzdBI6CgVzb2x2ZRgKIAEoCzIpLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuQ3BTYXRTb2x2ZVJlcXVlc3RIABJACgh2YWxpZGF0ZRgLIAEoCzIsLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuQ3BTYXRWYWxpZGF0ZVJlcXVlc3RIAEIJCgdwYXlsb2FkIuoBChNDcFNhdEJyaWRnZVJlc3BvbnNlEkAKDHNvbHZlX3Jlc3VsdBgKIAEoCzIoLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuQ3BTYXRTb2x2ZVJlc3VsdEgAEj4KC3NvbHZlX2V2ZW50GAsgASgLMicub3J0b29sc193YXNtLmJyaWRnZS52MS5DcFNhdFNvbHZlRXZlbnRIABJGCg92YWxpZGF0ZV9yZXN1bHQYDCABKAsyKy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLkNwU2F0VmFsaWRhdGVSZXN1bHRIAEIJCgdwYXlsb2FkIosBChFDcFNhdFNvbHZlUmVxdWVzdBIWCg5jcF9tb2RlbF9wcm90bxgBIAEoDBIcChRzYXRfcGFyYW1ldGVyc19wcm90bxgCIAEoDBJACg1jYWxsYmFja19tYXNrGAMgASgLMikub3J0b29sc193YXNtLmJyaWRnZS52MS5DcFNhdENhbGxiYWNrTWFzayJGChFDcFNhdENhbGxiYWNrTWFzaxIQCghzb2x1dGlvbhgBIAEoCBISCgpiZXN0X2JvdW5kGAIgASgIEgsKA2xvZxgDIAEoCCI0ChBDcFNhdFNvbHZlUmVzdWx0EiAKGGNwX3NvbHZlcl9yZXNwb25zZV9wcm90bxgBIAEoDCJbCg9DcFNhdFNvbHZlRXZlbnQSGAoOc29sdXRpb25fcHJvdG8YASABKAxIABIUCgpiZXN0X2JvdW5kGAIgASgBSAASDQoDbG9nGAMgASgJSABCCQoHcGF5bG9hZCIuChRDcFNhdFZhbGlkYXRlUmVxdWVzdBIWCg5jcF9tb2RlbF9wcm90bxgBIAEoDCIyChNDcFNhdFZhbGlkYXRlUmVzdWx0EgoKAm9rGAEgASgIEg8KB21lc3NhZ2UYAiABKAliBnByb3RvMw"), CpSatBridgeRequestSchema = /* @__PURE__ */ (0, import_codegenv2.messageDesc)(file_cp_sat, 0), CpSatBridgeResponseSchema = /* @__PURE__ */ (0, import_codegenv2.messageDesc)(file_cp_sat, 1), CpSatSolveRequestSchema = /* @__PURE__ */ (0, import_codegenv2.messageDesc)(file_cp_sat, 2), CpSatCallbackMaskSchema = /* @__PURE__ */ (0, import_codegenv2.messageDesc)(file_cp_sat, 3), CpSatSolveResultSchema = /* @__PURE__ */ (0, import_codegenv2.messageDesc)(file_cp_sat, 4), CpSatSolveEventSchema = /* @__PURE__ */ (0, import_codegenv2.messageDesc)(file_cp_sat, 5), CpSatValidateRequestSchema = /* @__PURE__ */ (0, import_codegenv2.messageDesc)(file_cp_sat, 6), CpSatValidateResultSchema = /* @__PURE__ */ (0, import_codegenv2.messageDesc)(file_cp_sat, 7);

// javascript/lib/cp_sat/protocol.ts
function decodeRequest(payload) {
  let request = (0, import_protobuf.fromBinary)(CpSatBridgeRequestSchema, payload);
  switch (request.payload.case) {
    case "solve": {
      let { cpModelProto, satParametersProto, callbackMask } = request.payload.value;
      return {
        type: "solve",
        model: cpModelProto,
        parameters: satParametersProto,
        callbacks: {
          solution: callbackMask?.solution ?? !1,
          bestBound: callbackMask?.bestBound ?? !1,
          log: callbackMask?.log ?? !1
        }
      };
    }
    case "validate":
      return { type: "validate", model: request.payload.value.cpModelProto };
    default:
      throw new Error("CP-SAT bridge request has no operation.");
  }
}
function decodeResponse(payload) {
  return (0, import_protobuf.fromBinary)(CpSatBridgeResponseSchema, payload);
}
var cpSatProtocol = {
  solver: "cp-sat",
  label: "CP-SAT",
  encodeRequest: (operation) => {
    let payload = operation.type === "solve" ? {
      case: "solve",
      value: (0, import_protobuf.create)(CpSatSolveRequestSchema, {
        cpModelProto: operation.model,
        satParametersProto: operation.parameters,
        callbackMask: (0, import_protobuf.create)(CpSatCallbackMaskSchema, operation.callbacks)
      })
    } : {
      case: "validate",
      value: (0, import_protobuf.create)(CpSatValidateRequestSchema, {
        cpModelProto: operation.model
      })
    };
    return (0, import_protobuf.toBinary)(
      CpSatBridgeRequestSchema,
      (0, import_protobuf.create)(CpSatBridgeRequestSchema, { payload })
    );
  },
  decodeRequest,
  encodeResult: (result) => {
    let payload = result.type === "solve" ? {
      case: "solveResult",
      value: (0, import_protobuf.create)(CpSatSolveResultSchema, {
        cpSolverResponseProto: result.response
      })
    } : {
      case: "validateResult",
      value: (0, import_protobuf.create)(CpSatValidateResultSchema, {
        ok: result.ok,
        message: result.message
      })
    };
    return (0, import_protobuf.toBinary)(
      CpSatBridgeResponseSchema,
      (0, import_protobuf.create)(CpSatBridgeResponseSchema, { payload })
    );
  },
  decodeResult: (payload) => {
    let response = decodeResponse(payload);
    switch (response.payload.case) {
      case "solveResult":
        return {
          type: "solve",
          response: response.payload.value.cpSolverResponseProto
        };
      case "validateResult":
        return {
          type: "validate",
          ok: response.payload.value.ok,
          message: response.payload.value.message
        };
      default:
        throw new Error("CP-SAT bridge response has no result.");
    }
  },
  encodeEvent: (event) => {
    let payload = event.type === "solution" ? { case: "solutionProto", value: event.response } : event.type === "bestBound" ? { case: "bestBound", value: event.bound } : { case: "log", value: event.message };
    return (0, import_protobuf.toBinary)(CpSatBridgeResponseSchema, (0, import_protobuf.create)(CpSatBridgeResponseSchema, {
      payload: {
        case: "solveEvent",
        value: (0, import_protobuf.create)(CpSatSolveEventSchema, { payload })
      }
    }));
  },
  decodeEvent: (payload) => {
    let response = decodeResponse(payload);
    if (response.payload.case !== "solveEvent") return null;
    let event = response.payload.value.payload;
    switch (event.case) {
      case "solutionProto":
        return { type: "solution", response: event.value };
      case "bestBound":
        return { type: "bestBound", bound: event.value };
      case "log":
        return { type: "log", message: event.value };
      default:
        return null;
    }
  }
};

// javascript/lib/wasm_memory.ts
function allocateWasmBytes(module, bytes) {
  if (!bytes?.length) return 0;
  let pointer = module._malloc(bytes.length);
  return module.HEAPU8.set(bytes, pointer), pointer;
}
async function readWasmResult(module, invoke, release = (pointer) => module._free(pointer)) {
  let lengthPointer = module._malloc(Uint32Array.BYTES_PER_ELEMENT), resultPointer = 0;
  try {
    resultPointer = await invoke(lengthPointer);
    let length = new DataView(
      module.HEAPU8.buffer,
      lengthPointer,
      Uint32Array.BYTES_PER_ELEMENT
    ).getUint32(0, !0);
    return resultPointer && length ? module.HEAPU8.slice(resultPointer, resultPointer + length) : new Uint8Array();
  } finally {
    resultPointer && release(resultPointer), module._free(lengthPointer);
  }
}

// javascript/lib/runtime_loader_core.ts
function isJspiSupported() {
  return typeof globalThis.WebAssembly?.promising == "function";
}
function preferredRuntimeFlavor() {
  return isJspiSupported() ? "jspi" : "asyncify";
}
function createRuntimeLoader(adapter) {
  let modulePromises = {}, selectedFlavor = null;
  function selectRuntimeFlavor() {
    return selectedFlavor || (selectedFlavor = preferredRuntimeFlavor(), adapter.logFlavorSelection && console.log(
      selectedFlavor === "jspi" ? "JSPI is supported. Using JSPI runtime." : "Using Asyncify runtime."
    ), selectedFlavor);
  }
  async function createRuntime(runtimeName, flavor = selectRuntimeFlavor()) {
    let key = `${runtimeName}:${flavor}`;
    return modulePromises[key] ?? (modulePromises[key] = (async () => {
      let asset = await adapter.resolveAsset(runtimeName, flavor), createModule = await adapter.loadFactory(asset.jsUrl), moduleOverrides = {
        locateFile: asset.locateFile,
        noExitRuntime: !0
      };
      asset.wasmBinary && (moduleOverrides.wasmBinary = asset.wasmBinary), asset.mainScriptUrlOrBlob && (moduleOverrides.mainScriptUrlOrBlob = asset.mainScriptUrlOrBlob);
      try {
        return await createModule(moduleOverrides);
      } finally {
        asset.cleanupGlobalState?.();
      }
    })()), modulePromises[key];
  }
  async function terminateLoadedRuntimeThreads3() {
    let modules = await Promise.allSettled(Object.values(modulePromises));
    for (let moduleResult of modules) {
      if (moduleResult.status !== "fulfilled") continue;
      let module = moduleResult.value;
      try {
        Object.prototype.hasOwnProperty.call(module, "PThread") && module.PThread?.terminateAllThreads?.();
      } catch (error) {
        if (!String(error).includes("PThread")) throw error;
      }
    }
  }
  return {
    terminateLoadedRuntimeThreads: terminateLoadedRuntimeThreads3,
    loadRuntime: () => createRuntime("cp_sat_runtime"),
    loadRuntimeAsyncify: () => createRuntime("cp_sat_runtime", "asyncify"),
    loadRoutingRuntime: () => createRuntime("routing_runtime"),
    loadRoutingRuntimeAsyncify: () => createRuntime("routing_runtime", "asyncify"),
    loadMPSolverRuntime: () => createRuntime("mp_solver_runtime"),
    loadMPSolverRuntimeAsyncify: () => createRuntime("mp_solver_runtime", "asyncify"),
    loadMathOptRuntime: () => createRuntime("mathopt_runtime"),
    loadMathOptRuntimeAsyncify: () => createRuntime("mathopt_runtime", "asyncify"),
    loadPdlpRuntime: () => createRuntime("pdlp_runtime"),
    loadPdlpRuntimeAsyncify: () => createRuntime("pdlp_runtime", "asyncify"),
    loadGraphRuntime: () => createRuntime("graph_runtime"),
    loadGraphRuntimeAsyncify: () => createRuntime("graph_runtime", "asyncify"),
    loadSetCoverRuntime: () => createRuntime("set_cover_runtime"),
    loadSetCoverRuntimeAsyncify: () => createRuntime("set_cover_runtime", "asyncify")
  };
}

// javascript/lib/runtime_loader.ts
var runtimeAssets = {cp_sat_runtime: {jspi: {
 jsUrl: new URL("../wasm/cp_sat_runtime.js", import.meta.url).href,
 wasmUrl: new URL("../wasm/cp_sat_runtime.wasm", import.meta.url).href
}}};
async function loadFactory(runtimeUrl) {
  let { default: createModule } = await import(
    /* webpackIgnore: true */
    /* @vite-ignore */
    runtimeUrl
  );
  return createModule;
}
function runtimeAssetName(url) {
  return (new URL(url).pathname.split("/").pop() ?? "").replace(/-[A-Za-z0-9_-]+(?=\.(?:js|wasm)$)/, "");
}
function locateRuntimeFile(fileName) {
  for (let flavors of Object.values(runtimeAssets))
    for (let asset of Object.values(flavors)) {
      if (fileName === runtimeAssetName(asset.jsUrl)) return asset.jsUrl;
      if (fileName === runtimeAssetName(asset.wasmUrl)) return asset.wasmUrl;
    }
  return fileName;
}
var loader = createRuntimeLoader({
  logFlavorSelection: !0,
  loadFactory,
  async resolveAsset(runtimeName, flavor) {
    let asset = runtimeAssets[runtimeName][flavor], wasmBinary = new Uint8Array(await (await fetch(asset.wasmUrl)).arrayBuffer());
    return {
      jsUrl: asset.jsUrl,
      locateFile: locateRuntimeFile,
      wasmBinary,
      mainScriptUrlOrBlob: asset.jsUrl
    };
  }
});
var terminateLoadedRuntimeThreads = loader.terminateLoadedRuntimeThreads, loadRuntime = loader.loadRuntime, loadRuntimeAsyncify = loader.loadRuntimeAsyncify, loadRoutingRuntime = loader.loadRoutingRuntime, loadRoutingRuntimeAsyncify = loader.loadRoutingRuntimeAsyncify, loadMPSolverRuntime = loader.loadMPSolverRuntime, loadMPSolverRuntimeAsyncify = loader.loadMPSolverRuntimeAsyncify, loadMathOptRuntime = loader.loadMathOptRuntime, loadMathOptRuntimeAsyncify = loader.loadMathOptRuntimeAsyncify, loadPdlpRuntime = loader.loadPdlpRuntime, loadPdlpRuntimeAsyncify = loader.loadPdlpRuntimeAsyncify, loadGraphRuntime = loader.loadGraphRuntime, loadGraphRuntimeAsyncify = loader.loadGraphRuntimeAsyncify, loadSetCoverRuntime = loader.loadSetCoverRuntime, loadSetCoverRuntimeAsyncify = loader.loadSetCoverRuntimeAsyncify;

// javascript/lib/solver_executor.ts
var import_protobuf2 = __toESM(require_commonjs(), 1);

// javascript/lib/generated/bridge/job_pb.ts
var import_codegenv22 = __toESM(require_codegenv2(), 1), file_job = /* @__PURE__ */ (0, import_codegenv22.fileDesc)("Cglqb2IucHJvdG8SFm9ydG9vbHNfd2FzbS5icmlkZ2UudjEi4gEKE1NvbHZlckJyaWRnZVJlcXVlc3QSEgoKcmVxdWVzdF9pZBgBIAEoDRIOCgZzb2x2ZXIYAiABKAkSQAoJcmVzb3VyY2VzGAMgASgLMi0ub3J0b29sc193YXNtLmJyaWRnZS52MS5Tb2x2ZXJSZXNvdXJjZVJlcXVlc3QSGQoPZXhlY3V0ZV9wYXlsb2FkGAogASgMSAASPQoGY2FuY2VsGAsgASgLMisub3J0b29sc193YXNtLmJyaWRnZS52MS5Tb2x2ZXJDYW5jZWxSZXF1ZXN0SABCCwoJb3BlcmF0aW9uIigKFVNvbHZlclJlc291cmNlUmVxdWVzdBIPCgd0aHJlYWRzGAEgASgNIjAKE1NvbHZlckNhbmNlbFJlcXVlc3QSGQoRdGFyZ2V0X3JlcXVlc3RfaWQYASABKA0ikgMKFFNvbHZlckJyaWRnZVJlc3BvbnNlEhIKCnJlcXVlc3RfaWQYASABKA0SDgoGc29sdmVyGAIgASgJEg4KBmpvYl9pZBgDIAEoBBITCgtzZXF1ZW5jZV9pZBgEIAEoBBI5CgZzdGF0dXMYCiABKAsyJy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlNvbHZlckpvYlN0YXR1c0gAEjsKB2ZhaWx1cmUYCyABKAsyKC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlNvbHZlckpvYkZhaWx1cmVIABIXCg1ldmVudF9wYXlsb2FkGAwgASgMSAASGAoOcmVzdWx0X3BheWxvYWQYDSABKAxIABI/CgljYW5jZWxsZWQYDiABKAsyKi5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlNvbHZlckpvYkNhbmNlbGxlZEgAEjoKBXJlYWR5GA8gASgLMikub3J0b29sc193YXNtLmJyaWRnZS52MS5Tb2x2ZXJXb3JrZXJSZWFkeUgAQgkKB3BheWxvYWQiEwoRU29sdmVyV29ya2VyUmVhZHkiLwoSU29sdmVySm9iQ2FuY2VsbGVkEhkKEXRhcmdldF9yZXF1ZXN0X2lkGAEgASgNIlMKEFNvbHZlckV2ZW50QmF0Y2gSPwoJcmVzcG9uc2VzGAEgAygLMiwub3J0b29sc193YXNtLmJyaWRnZS52MS5Tb2x2ZXJCcmlkZ2VSZXNwb25zZSLNAQoPU29sdmVySm9iU3RhdHVzEhIKCnJlcXVlc3RfaWQYASABKA0SDgoGc29sdmVyGAIgASgJEjUKBXN0YXRlGAMgASgOMiYub3J0b29sc193YXNtLmJyaWRnZS52MS5Tb2x2ZXJKb2JTdGF0ZRIVCg1jcmVhdGVkX2F0X21zGAQgASgEEhUKDXN0YXJ0ZWRfYXRfbXMYBSABKAQSGQoRYWxsb2NhdGVkX3RocmVhZHMYBiABKA0SFgoOcXVldWVfcG9zaXRpb24YByABKA0iogEKEFNvbHZlckpvYkZhaWx1cmUSEgoKcmVxdWVzdF9pZBgBIAEoDRIOCgZzb2x2ZXIYAiABKAkSNwoEa2luZBgDIAEoDjIpLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuU29sdmVyRmFpbHVyZUtpbmQSDwoHbWVzc2FnZRgEIAEoCRINCgV0cmFjZRgFIAEoCRIRCglyZXRyeWFibGUYBiABKAgqigIKDlNvbHZlckpvYlN0YXRlEiAKHFNPTFZFUl9KT0JfU1RBVEVfVU5TUEVDSUZJRUQQABIbChdTT0xWRVJfSk9CX1NUQVRFX1FVRVVFRBABEh0KGVNPTFZFUl9KT0JfU1RBVEVfU1RBUlRJTkcQAhIcChhTT0xWRVJfSk9CX1NUQVRFX1JVTk5JTkcQAxIfChtTT0xWRVJfSk9CX1NUQVRFX0NBTkNFTExJTkcQBBIeChpTT0xWRVJfSk9CX1NUQVRFX0NBTkNFTExFRBAFEh4KGlNPTFZFUl9KT0JfU1RBVEVfU1VDQ0VFREVEEAYSGwoXU09MVkVSX0pPQl9TVEFURV9GQUlMRUQQByrnAwoRU29sdmVyRmFpbHVyZUtpbmQSIwofU09MVkVSX0ZBSUxVUkVfS0lORF9VTlNQRUNJRklFRBAAEiYKIlNPTFZFUl9GQUlMVVJFX0tJTkRfRVhFQ1VUT1JfRVJST1IQARIqCiZTT0xWRVJfRkFJTFVSRV9LSU5EX1JVTlRJTUVfTE9BRF9FUlJPUhACEiQKIFNPTFZFUl9GQUlMVVJFX0tJTkRfV09SS0VSX0NSQVNIEAMSKwonU09MVkVSX0ZBSUxVUkVfS0lORF9TRVJWRVJfRElTQ09OTkVDVEVEEAQSHwobU09MVkVSX0ZBSUxVUkVfS0lORF9USU1FT1VUEAUSIQodU09MVkVSX0ZBSUxVUkVfS0lORF9DQU5DRUxMRUQQBhIgChxTT0xWRVJfRkFJTFVSRV9LSU5EX0lOVEVSTkFMEAcSJwojU09MVkVSX0ZBSUxVUkVfS0lORF9JTlZBTElEX1JFUVVFU1QQCBInCiNTT0xWRVJfRkFJTFVSRV9LSU5EX1VOQVVUSEVOVElDQVRFRBAJEiIKHlNPTFZFUl9GQUlMVVJFX0tJTkRfUVVFVUVfRlVMTBAKEioKJlNPTFZFUl9GQUlMVVJFX0tJTkRfVU5TVVBQT1JURURfU09MVkVSEAtiBnByb3RvMw"), SolverBridgeRequestSchema = /* @__PURE__ */ (0, import_codegenv22.messageDesc)(file_job, 0), SolverResourceRequestSchema = /* @__PURE__ */ (0, import_codegenv22.messageDesc)(file_job, 1), SolverCancelRequestSchema = /* @__PURE__ */ (0, import_codegenv22.messageDesc)(file_job, 2), SolverBridgeResponseSchema = /* @__PURE__ */ (0, import_codegenv22.messageDesc)(file_job, 3);
var SolverEventBatchSchema = /* @__PURE__ */ (0, import_codegenv22.messageDesc)(file_job, 6), SolverJobStatusSchema = /* @__PURE__ */ (0, import_codegenv22.messageDesc)(file_job, 7), SolverJobFailureSchema = /* @__PURE__ */ (0, import_codegenv22.messageDesc)(file_job, 8), SolverJobState = /* @__PURE__ */ ((SolverJobState3) => (SolverJobState3[SolverJobState3.UNSPECIFIED = 0] = "UNSPECIFIED", SolverJobState3[SolverJobState3.QUEUED = 1] = "QUEUED", SolverJobState3[SolverJobState3.STARTING = 2] = "STARTING", SolverJobState3[SolverJobState3.RUNNING = 3] = "RUNNING", SolverJobState3[SolverJobState3.CANCELLING = 4] = "CANCELLING", SolverJobState3[SolverJobState3.CANCELLED = 5] = "CANCELLED", SolverJobState3[SolverJobState3.SUCCEEDED = 6] = "SUCCEEDED", SolverJobState3[SolverJobState3.FAILED = 7] = "FAILED", SolverJobState3))(SolverJobState || {});
var SolverFailureKind = /* @__PURE__ */ ((SolverFailureKind3) => (SolverFailureKind3[SolverFailureKind3.UNSPECIFIED = 0] = "UNSPECIFIED", SolverFailureKind3[SolverFailureKind3.EXECUTOR_ERROR = 1] = "EXECUTOR_ERROR", SolverFailureKind3[SolverFailureKind3.RUNTIME_LOAD_ERROR = 2] = "RUNTIME_LOAD_ERROR", SolverFailureKind3[SolverFailureKind3.WORKER_CRASH = 3] = "WORKER_CRASH", SolverFailureKind3[SolverFailureKind3.SERVER_DISCONNECTED = 4] = "SERVER_DISCONNECTED", SolverFailureKind3[SolverFailureKind3.TIMEOUT = 5] = "TIMEOUT", SolverFailureKind3[SolverFailureKind3.CANCELLED = 6] = "CANCELLED", SolverFailureKind3[SolverFailureKind3.INTERNAL = 7] = "INTERNAL", SolverFailureKind3[SolverFailureKind3.INVALID_REQUEST = 8] = "INVALID_REQUEST", SolverFailureKind3[SolverFailureKind3.UNAUTHENTICATED = 9] = "UNAUTHENTICATED", SolverFailureKind3[SolverFailureKind3.QUEUE_FULL = 10] = "QUEUE_FULL", SolverFailureKind3[SolverFailureKind3.UNSUPPORTED_SOLVER = 11] = "UNSUPPORTED_SOLVER", SolverFailureKind3))(SolverFailureKind || {});

// javascript/lib/solver_executor.ts
var DEFAULT_SOLVER_STATUS_INTERVAL_MS = 2e3, SolverJobState2 = SolverJobState, SolverFailureKind2 = SolverFailureKind, SolverExecutorBusyError = class extends Error {
  constructor(solver) {
    super(`${solver} executor already has an active job.`), this.name = "SolverExecutorBusyError";
  }
}, SolverJobCancelledError = class extends Error {
  constructor(solver, requestId) {
    super(`${solver} worker job ${requestId} was cancelled.`), this.name = "AbortError";
  }
}, SolverCancellationUnsupportedError = class extends Error {
  constructor(solver) {
    super(`${solver} direct executor does not support cancellation.`), this.name = "SolverCancellationUnsupportedError";
  }
};
function createSolverJobStatusEvent(solver, requestId, state, createdAtMs, startedAtMs = 0n, allocatedThreads = 0, queuePosition = 0) {
  return {
    type: "status",
    status: (0, import_protobuf2.create)(SolverJobStatusSchema, {
      requestId,
      solver,
      state,
      createdAtMs,
      startedAtMs,
      allocatedThreads,
      queuePosition
    })
  };
}
function createSolverFailureEvent(solver, requestId, message, kind = SolverFailureKind2.INTERNAL, trace = "", retryable = !1) {
  return {
    type: "failure",
    failure: (0, import_protobuf2.create)(SolverJobFailureSchema, {
      requestId,
      solver,
      kind,
      message,
      trace,
      retryable
    })
  };
}

// javascript/lib/cp_sat/direct_executor.ts
var SOLUTION_CALLBACK_FLAG = 1, BEST_BOUND_CALLBACK_FLAG = 2, LOG_CALLBACK_FLAG = 4, SOLUTION_CALLBACK_EVENT = 1, BEST_BOUND_CALLBACK_EVENT = 2, LOG_CALLBACK_EVENT = 3;
function callbackFlags(mask) {
  let flags = 0;
  return mask?.solution && (flags |= SOLUTION_CALLBACK_FLAG), mask?.bestBound && (flags |= BEST_BOUND_CALLBACK_FLAG), mask?.log && (flags |= LOG_CALLBACK_FLAG), flags;
}
function cpSatWasmCallbacks(module) {
  return module.__ortoolsCpSatCallbacks ?? (module.__ortoolsCpSatCallbacks = {
    nextId: 1,
    sinks: /* @__PURE__ */ new Map()
  });
}
function cpSatCallbackEvent(eventType, payload) {
  return eventType === SOLUTION_CALLBACK_EVENT ? { type: "solution", response: payload } : eventType === BEST_BOUND_CALLBACK_EVENT ? {
    type: "bestBound",
    bound: new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getFloat64(0, !0)
  } : eventType === LOG_CALLBACK_EVENT ? { type: "log", message: new TextDecoder().decode(payload) } : null;
}
function nowMs() {
  return BigInt(Date.now());
}
function createCpSatJobStatusEvent(requestId, state, createdAtMs, startedAtMs = 0n) {
  return createSolverJobStatusEvent(
    "cp-sat",
    requestId,
    state,
    createdAtMs,
    startedAtMs
  );
}
function createCpSatFailureEvent(requestId, message, kind = SolverFailureKind2.INTERNAL, trace = "", retryable = !1) {
  return createSolverFailureEvent("cp-sat", requestId, message, kind, trace, retryable);
}
var DirectCpSatExecutor = class {
  constructor(loadModuleImpl = loadRuntime) {
    this.loadModuleImpl = loadModuleImpl;
    this.solver = "cp-sat";
    this.modulePromise = null;
    this.nextRequestId = 1;
    this.activeJob = null;
  }
  async load() {
    await this.module();
  }
  module() {
    return this.modulePromise ?? (this.modulePromise = this.loadModuleImpl()), this.modulePromise;
  }
  execute(payload, options) {
    if (this.activeJob) throw new SolverExecutorBusyError(this.solver);
    let requestId = this.nextCpSatRequestId(), state = {};
    return this.activeJob = state, {
      requestId,
      result: this.run(requestId, payload, options.onEvent).finally(() => {
        this.activeJob === state && (this.activeJob = null);
      }),
      cancel: () => Promise.reject(new SolverCancellationUnsupportedError(this.solver))
    };
  }
  async run(requestId, payload, onEvent) {
    let createdAtMs = nowMs();
    try {
      await onEvent(createCpSatJobStatusEvent(
        requestId,
        SolverJobState2.STARTING,
        createdAtMs
      ));
      let result;
      switch (payload.type) {
        case "solve":
          result = {
            response: await this.solve(requestId, payload, createdAtMs, onEvent),
            terminalState: SolverJobState2.SUCCEEDED
          };
          break;
        case "validate":
          result = {
            response: await this.validate(requestId, payload, createdAtMs, onEvent),
            terminalState: SolverJobState2.SUCCEEDED
          };
          break;
        default:
          throw new Error("Unsupported CP-SAT operation.");
      }
      return await onEvent(createCpSatJobStatusEvent(
        requestId,
        result.terminalState,
        createdAtMs
      )), result.response;
    } catch (error) {
      let message = error instanceof Error ? error.message : String(error), trace = error instanceof Error ? error.stack ?? "" : "", failure = createCpSatFailureEvent(requestId, message, SolverFailureKind2.INTERNAL, trace);
      throw await onEvent(failure), await onEvent(createCpSatJobStatusEvent(
        requestId,
        SolverJobState2.FAILED,
        createdAtMs
      )), error;
    }
  }
  terminate(_reason) {
  }
  nextCpSatRequestId() {
    return this.nextRequestId++;
  }
  async solve(requestId, solveRequest, createdAtMs, onEvent) {
    let module = await this.module(), startedAtMs = nowMs();
    await onEvent(createCpSatJobStatusEvent(
      requestId,
      SolverJobState2.RUNNING,
      createdAtMs,
      startedAtMs
    ));
    let modelBytes = solveRequest.model, paramsBytes = solveRequest.parameters, flags = callbackFlags(solveRequest.callbacks), modelPtr = allocateWasmBytes(module, modelBytes), paramsPtr = allocateWasmBytes(module, paramsBytes), callbackId = 0, callbackError = null, pendingCallbacks = [];
    try {
      let bytes = await readWasmResult(module, async (lengthPointer) => {
        if (!flags)
          return await module.ccall(
            "solve_model",
            "number",
            ["number", "number", "number", "number", "number"],
            [modelPtr, modelBytes.length, paramsPtr, paramsBytes.length, lengthPointer],
            { async: !0 }
          );
        let callbacks = cpSatWasmCallbacks(module);
        return callbackId = callbacks.nextId++, callbacks.sinks.set(callbackId, (eventType, payload) => {
          let event = cpSatCallbackEvent(eventType, payload);
          if (!(!event || callbackError))
            try {
              let pending = onEvent(event);
              pending && pendingCallbacks.push(Promise.resolve(pending).catch((error) => {
                callbackError ?? (callbackError = error);
              }));
            } catch (error) {
              callbackError ?? (callbackError = error);
            }
        }), await module.ccall(
          "solve_model_with_callback_events",
          "number",
          ["number", "number", "number", "number", "number", "number", "number"],
          [modelPtr, modelBytes.length, paramsPtr, paramsBytes.length, flags, callbackId, lengthPointer],
          { async: !0 }
        );
      }, (pointer) => module._free_buffer(pointer));
      if (await Promise.all(pendingCallbacks), callbackError) throw callbackError;
      return { type: "solve", response: bytes };
    } finally {
      callbackId && cpSatWasmCallbacks(module).sinks.delete(callbackId), modelPtr && module._free(modelPtr), paramsPtr && module._free(paramsPtr);
    }
  }
  async validate(requestId, validateRequest, createdAtMs, onEvent) {
    let module = await this.module(), startedAtMs = nowMs();
    await onEvent(createCpSatJobStatusEvent(
      requestId,
      SolverJobState2.RUNNING,
      createdAtMs,
      startedAtMs
    ));
    let modelBytes = validateRequest.model, modelPtr = allocateWasmBytes(module, modelBytes);
    try {
      let bytes = await readWasmResult(
        module,
        (lengthPointer) => module.ccall(
          "validate_model",
          "number",
          ["number", "number", "number"],
          [modelPtr, modelBytes.length, lengthPointer],
          { async: !0 }
        ),
        (pointer) => module._free_buffer(pointer)
      ), message = new TextDecoder().decode(bytes);
      return { type: "validate", ok: message.length === 0, message };
    } finally {
      modelPtr && module._free(modelPtr);
    }
  }
};

// javascript/lib/package_metadata.ts
var packageName = "or-tools-wasm", version = "0.9.1";

// javascript/lib/cloud_executor.ts
var CLOUD_STATUS_URL = "https://or-tools-wasm-api.axelwickman.com/status", CloudExecutorUnavailableError = class extends Error {
  constructor(message = "OR-Tools WASM Cloud execution is not currently available.", options) {
    super(message), this.name = "CloudExecutorUnavailableError", this.cause = options?.cause;
  }
};
function processLike() {
  return globalThis.process;
}
function terminalSupportsColor() {
  let process2 = processLike();
  return !process2 || process2.env?.NO_COLOR !== void 0 ? !1 : process2.env?.FORCE_COLOR !== void 0 ? process2.env.FORCE_COLOR !== "0" : process2.stdout?.isTTY === !0;
}
var CloudExecutor = class {
  constructor(solver, options = {}) {
    this.solver = solver;
    this.nextRequestId = 1;
    this.controllers = /* @__PURE__ */ new Set();
    this.fetchImpl = options.fetch ?? globalThis.fetch, this.log = options.log ?? ((message) => console.info(message)), this.test = options.test === !0;
  }
  async load() {
  }
  execute(_request, options) {
    let requestId = this.nextRequestId++, controller = new AbortController();
    return this.controllers.add(controller), {
      requestId,
      result: this.run(requestId, controller, options),
      cancel: () => this.cancel(requestId, controller, options)
    };
  }
  terminate(reason) {
    for (let controller of this.controllers.values()) controller.abort(reason);
    this.controllers.clear();
  }
  async run(requestId, controller, options) {
    let createdAtMs = BigInt(Date.now()), onEvent = options.onEvent;
    await onEvent(createSolverJobStatusEvent(
      this.solver,
      requestId,
      SolverJobState2.STARTING,
      createdAtMs
    ));
    try {
      let statusMessage = await (await this.fetchImpl(CLOUD_STATUS_URL, {
        method: "POST",
        headers: {
          accept: terminalSupportsColor() ? "text/x-ansi" : "text/plain",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          package: packageName,
          version,
          ...this.test ? { test: !0 } : {}
        }),
        signal: controller.signal
      })).text();
      statusMessage && this.log(statusMessage);
      let error = new CloudExecutorUnavailableError();
      throw await onEvent(createSolverFailureEvent(
        this.solver,
        requestId,
        error.message,
        SolverFailureKind2.UNSUPPORTED_SOLVER
      )), await onEvent(createSolverJobStatusEvent(
        this.solver,
        requestId,
        SolverJobState2.FAILED,
        createdAtMs
      )), error;
    } catch (error) {
      if (error instanceof CloudExecutorUnavailableError) throw error;
      if (controller.signal.aborted) {
        let cancelled = new CloudExecutorUnavailableError(
          "OR-Tools WASM Cloud status request was cancelled.",
          { cause: error }
        );
        throw await onEvent(createSolverFailureEvent(
          this.solver,
          requestId,
          cancelled.message,
          SolverFailureKind2.CANCELLED
        )), await onEvent(createSolverJobStatusEvent(
          this.solver,
          requestId,
          SolverJobState2.CANCELLED,
          createdAtMs
        )), cancelled;
      }
      let unavailable = new CloudExecutorUnavailableError(
        "Could not reach OR-Tools WASM Cloud.",
        { cause: error }
      );
      throw await onEvent(createSolverFailureEvent(
        this.solver,
        requestId,
        unavailable.message,
        SolverFailureKind2.EXECUTOR_ERROR
      )), await onEvent(createSolverJobStatusEvent(
        this.solver,
        requestId,
        SolverJobState2.FAILED,
        createdAtMs
      )), unavailable;
    } finally {
      this.controllers.delete(controller);
    }
  }
  async cancel(requestId, controller, options) {
    this.controllers.has(controller) && (await options.onEvent(createSolverJobStatusEvent(
      this.solver,
      requestId,
      SolverJobState2.CANCELLING,
      BigInt(Date.now())
    )), controller.abort());
  }
};

// javascript/lib/solver_server_executor.ts
var import_protobuf4 = __toESM(require_commonjs(), 1);

// javascript/lib/solver_bridge.ts
var import_protobuf3 = __toESM(require_commonjs(), 1);
function encodeSolverBridgeRequest(input) {
  return (0, import_protobuf3.toBinary)(SolverBridgeRequestSchema, (0, import_protobuf3.create)(SolverBridgeRequestSchema, {
    requestId: input.requestId,
    solver: input.solver,
    resources: (0, import_protobuf3.create)(SolverResourceRequestSchema, {
      threads: input.resources?.threads ?? 0
    }),
    operation: { case: "executePayload", value: input.payload }
  }));
}
function encodeSolverBridgeCancelRequest(requestId, solver, targetRequestId) {
  return (0, import_protobuf3.toBinary)(SolverBridgeRequestSchema, (0, import_protobuf3.create)(SolverBridgeRequestSchema, {
    requestId,
    solver,
    operation: {
      case: "cancel",
      value: (0, import_protobuf3.create)(SolverCancelRequestSchema, { targetRequestId })
    }
  }));
}
function decodeSolverBridgeRequest(bytes) {
  return (0, import_protobuf3.fromBinary)(SolverBridgeRequestSchema, bytes);
}
function decodeSolverBridgeResponse(bytes) {
  return (0, import_protobuf3.fromBinary)(SolverBridgeResponseSchema, bytes);
}

// javascript/lib/solver_server_executor.ts
var PROTOBUF_CONTENT_TYPE = "application/x-protobuf", EVENT_STREAM_CONTENT_TYPE = "text/event-stream", JOB_ACCEPTED_STATUS = 202, JOB_NOT_READY_STATUS = 204, JOB_STREAM_NOT_READY_STATUS = 409, RemoteSolverError = class extends Error {
  constructor(failure, emitted = !1) {
    super(failure.message);
    this.failure = failure;
    this.emitted = emitted;
    failure.trace && (this.stack = failure.trace);
  }
};
function bytesBody(bytes) {
  return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function decodeBase64Bytes(value) {
  let binary = globalThis.atob(value), bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}
async function* serverSentEventData(body) {
  let reader = body.getReader(), decoder = new TextDecoder(), buffer = "";
  try {
    for (; ; ) {
      let chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done }), buffer = buffer.replace(/\r\n/g, `
`);
      let separator = buffer.indexOf(`

`);
      for (; separator >= 0; ) {
        let frame = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        let data = frame.split(`
`).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join(`
`);
        data && (yield data), separator = buffer.indexOf(`

`);
      }
      if (chunk.done) return;
    }
  } finally {
    reader.releaseLock();
  }
}
var SolverServerExecutor = class {
  constructor(codec, configuration) {
    this.codec = codec;
    this.nextRequestId = 1;
    this.solver = codec.solver;
    let value = String(configuration.url);
    this.baseUrl = value.endsWith("/") ? value : `${value}/`, this.headers = { ...configuration.headers }, configuration.authToken && (this.headers.Authorization = `Bearer ${configuration.authToken}`);
    let fetchImpl = configuration.fetch ?? globalThis.fetch;
    if (typeof fetchImpl != "function") throw new Error(`${codec.label} server executor requires fetch().`);
    this.fetchImpl = fetchImpl.bind(globalThis), this.statusIntervalMs = configuration.statusIntervalMs ?? DEFAULT_SOLVER_STATUS_INTERVAL_MS;
  }
  execute(request, options) {
    let requestId = this.nextRequestId++, submitted = this.submit(requestId, request, options.resources);
    return {
      requestId,
      result: this.run(requestId, submitted, options),
      cancel: () => this.cancel(requestId, submitted)
    };
  }
  async load() {
    let response = await this.fetchImpl(new URL("healthz", this.baseUrl), { headers: this.headers });
    if (!response.ok)
      throw new Error(`${this.codec.label} server health check failed (${response.status} ${response.statusText}).`);
  }
  terminate(_reason) {
  }
  async submit(requestId, request, resources) {
    let bytes = encodeSolverBridgeRequest({
      requestId,
      solver: this.solver,
      payload: this.codec.encodeRequest(request),
      resources
    }), response = await this.fetchImpl(new URL("jobs", this.baseUrl), {
      method: "POST",
      headers: { accept: PROTOBUF_CONTENT_TYPE, "content-type": PROTOBUF_CONTENT_TYPE, ...this.headers },
      body: bytesBody(bytes)
    });
    return response.ok || await this.throwHttpError("submission", response), decodeSolverBridgeResponse(new Uint8Array(await response.arrayBuffer()));
  }
  async run(requestId, submitted, options) {
    try {
      let accepted = await submitted, immediate = await this.handleResponse(accepted, options);
      if (immediate !== null) return immediate;
      if (accepted.jobId === 0n) throw new Error(`${this.codec.label} server did not return a job id.`);
      let streamed = await this.streamResult(
        accepted.jobId,
        accepted.sequenceId,
        options
      );
      return streamed.complete ? streamed.result : await this.pollResult(accepted.jobId, streamed.sequenceId, options);
    } catch (error) {
      throw error instanceof RemoteSolverError ? (error.emitted || await options.onEvent({ type: "failure", failure: error.failure }), error) : (await options.onEvent(createSolverFailureEvent(
        this.solver,
        requestId,
        error instanceof Error ? error.message : String(error),
        SolverFailureKind2.SERVER_DISCONNECTED,
        error instanceof Error ? error.stack ?? "" : "",
        !0
      )), error);
    }
  }
  async streamResult(jobId, initialSequenceId, options) {
    let sequenceId = initialSequenceId, response;
    try {
      response = await this.fetchImpl(
        new URL(`jobs/${jobId}/stream?after=${initialSequenceId}`, this.baseUrl),
        { headers: { accept: EVENT_STREAM_CONTENT_TYPE, ...this.headers } }
      );
    } catch {
      return { complete: !1, sequenceId };
    }
    if (response.status === 404 || response.status === JOB_STREAM_NOT_READY_STATUS)
      return { complete: !1, sequenceId };
    if (response.ok || await this.throwHttpError("event stream", response), !response.headers.get("content-type")?.includes(EVENT_STREAM_CONTENT_TYPE) || !response.body)
      return { complete: !1, sequenceId };
    try {
      for await (let data of serverSentEventData(response.body)) {
        let outer = decodeSolverBridgeResponse(decodeBase64Bytes(data));
        outer.sequenceId > sequenceId && (sequenceId = outer.sequenceId);
        let terminal = outer.payload.case === "resultPayload" || outer.payload.case === "failure";
        try {
          let result = await this.handleResponse(outer, options);
          if (result !== null) return { complete: !0, result };
        } finally {
          terminal && await this.release(jobId);
        }
      }
    } catch (error) {
      if (error instanceof RemoteSolverError) throw error;
      return { complete: !1, sequenceId };
    }
    return { complete: !1, sequenceId };
  }
  async pollResult(jobId, initialSequenceId, options) {
    let sequenceId = initialSequenceId, firstRequest = !0;
    for (; ; ) {
      firstRequest || await delay(this.statusIntervalMs), firstRequest = !1;
      let eventsResponse = await this.fetchImpl(
        new URL(`jobs/${jobId}/events?after=${sequenceId}`, this.baseUrl),
        { headers: { accept: PROTOBUF_CONTENT_TYPE, ...this.headers } }
      );
      eventsResponse.ok || await this.throwHttpError("events", eventsResponse);
      let eventBytes = new Uint8Array(await eventsResponse.arrayBuffer());
      if (eventBytes.byteLength) {
        let batch = (0, import_protobuf4.fromBinary)(SolverEventBatchSchema, eventBytes);
        for (let outer2 of batch.responses) {
          outer2.sequenceId > sequenceId && (sequenceId = outer2.sequenceId);
          let terminal2 = outer2.payload.case === "resultPayload" || outer2.payload.case === "failure";
          try {
            let result = await this.handleResponse(outer2, options);
            if (result !== null) return result;
          } finally {
            terminal2 && await this.release(jobId);
          }
        }
      }
      let outer = await this.fetchJob(new URL(`jobs/${jobId}/result`, this.baseUrl), "result");
      if (!outer) continue;
      let terminal = outer.payload.case === "resultPayload" || outer.payload.case === "failure";
      try {
        let result = await this.handleResponse(outer, options);
        if (result !== null) return result;
      } finally {
        terminal && await this.release(jobId);
      }
    }
  }
  async release(jobId) {
    await this.fetchImpl(new URL(`jobs/${jobId}`, this.baseUrl), {
      method: "DELETE",
      headers: this.headers
    }).catch(() => {
    });
  }
  async fetchJob(url, operation) {
    let response = await this.fetchImpl(url, {
      headers: { accept: PROTOBUF_CONTENT_TYPE, ...this.headers }
    });
    if (response.status === JOB_NOT_READY_STATUS) return null;
    response.status !== JOB_ACCEPTED_STATUS && !response.ok && await this.throwHttpError(operation, response);
    let bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength ? decodeSolverBridgeResponse(bytes) : null;
  }
  async handleResponse(outer, options) {
    if (outer.solver && outer.solver !== this.solver)
      throw new Error(`${this.codec.label} server returned response for solver ${outer.solver}.`);
    switch (outer.payload.case) {
      case "failure":
        throw await options.onEvent({ type: "failure", failure: outer.payload.value }), new RemoteSolverError(outer.payload.value, !0);
      case "status":
        return await options.onEvent({ type: "status", status: outer.payload.value }), null;
      case "eventPayload": {
        let event = this.codec.decodeEvent?.(outer.payload.value);
        return event != null && await options.onEvent(event), null;
      }
      case "resultPayload":
        return this.codec.decodeResult(outer.payload.value);
      default:
        return null;
    }
  }
  async cancel(targetRequestId, submitted) {
    let accepted = await submitted;
    if (accepted.jobId === 0n) throw new Error(`${this.codec.label} server did not return a job id.`);
    let bytes = encodeSolverBridgeCancelRequest(this.nextRequestId++, this.solver, targetRequestId), response = await this.fetchImpl(new URL(`jobs/${accepted.jobId}/cancel`, this.baseUrl), {
      method: "POST",
      headers: { accept: PROTOBUF_CONTENT_TYPE, "content-type": PROTOBUF_CONTENT_TYPE, ...this.headers },
      body: bytesBody(bytes)
    });
    response.ok || await this.throwHttpError("cancel", response);
    let responseBytes = new Uint8Array(await response.arrayBuffer());
    if (!responseBytes.byteLength) return;
    let acknowledgement = decodeSolverBridgeResponse(responseBytes);
    if (acknowledgement.payload.case === "failure")
      throw new RemoteSolverError(acknowledgement.payload.value);
    if (acknowledgement.payload.case !== "cancelled" || acknowledgement.payload.value.targetRequestId !== targetRequestId)
      throw new Error(`${this.codec.label} server returned an invalid cancellation acknowledgement.`);
  }
  async throwHttpError(operation, response) {
    if ((response.headers.get("content-type") ?? "").includes(PROTOBUF_CONTENT_TYPE)) {
      let bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength) {
        let outer = decodeSolverBridgeResponse(bytes);
        if (outer.payload.case === "failure") throw new RemoteSolverError(outer.payload.value);
      }
    }
    let detail = await response.text().catch(() => "");
    throw new Error(
      `${this.codec.label} server job ${operation} failed (${response.status} ${response.statusText}): ${detail}`
    );
  }
};

// javascript/lib/worker_helpers.ts
var ManagedWorker = class {
  constructor(options) {
    this.options = options;
    this.worker = null;
    this.workerPromise = null;
    this.readyPromise = null;
    this.rejectReady = null;
    this.pendingRequests = /* @__PURE__ */ new Map();
    this.generation = 0;
    this.terminationError = new Error("Worker terminated.");
  }
  async load() {
    (await this.ensureReady()).unref?.();
  }
  async post(request, onEvent, transfer, beforePost) {
    let generation = this.generation, worker = await this.ensureReady(generation);
    return worker.ref?.(), new Promise((resolve, reject) => {
      beforePost?.(), this.pendingRequests.set(this.options.getRequestId(request), {
        resolve,
        reject,
        onEvent,
        eventChain: Promise.resolve()
      }), worker.postMessage(request, transfer);
    });
  }
  terminate(reason) {
    let error = reason instanceof Error ? reason : new Error(reason ?? "Worker terminated.");
    this.generation++, this.terminationError = error, this.worker?.terminate(), this.worker = null, this.workerPromise = null, this.rejectReady?.(error), this.rejectReady = null, this.readyPromise = null;
    for (let pending of this.pendingRequests.values())
      pending.reject(error);
    this.pendingRequests.clear();
  }
  async ensureReady(generation = this.generation) {
    let worker = await this.ensureWorker(generation);
    if (!this.readyPromise)
      throw new Error("Worker ready state unavailable.");
    if (await this.readyPromise, generation !== this.generation) throw this.terminationError;
    return worker;
  }
  async ensureWorker(generation) {
    if (generation !== this.generation) throw this.terminationError;
    if (this.worker) return this.worker;
    this.workerPromise ?? (this.workerPromise = this.options.createWorker());
    let worker = await this.workerPromise;
    if (generation !== this.generation)
      throw worker.terminate(), this.terminationError;
    return this.worker = worker, this.workerPromise = null, this.readyPromise = new Promise((resolve, reject) => {
      this.rejectReady = reject;
      let handleMessage = (message) => {
        if (this.options.handleMessage?.(message)) return;
        if (this.options.isReady?.(message)) {
          this.rejectReady = null, resolve();
          return;
        }
        let id = this.options.getResponseId(message), pending = id === void 0 ? void 0 : this.pendingRequests.get(id);
        if (this.options.isEvent?.(message)) {
          pending?.onEvent && (pending.eventChain = pending.eventChain.then(() => pending.onEvent?.(message)).catch((error) => {
            this.pendingRequests.get(id) === pending && this.pendingRequests.delete(id), pending.reject(error), this.pendingRequests.size === 0 && worker.unref?.();
          }));
          return;
        }
        if (this.options.isError?.(message)) {
          let error = new Error(this.options.errorMessage?.(message) ?? "Worker request failed.");
          pending ? (pending.reject(error), this.pendingRequests.delete(id), this.pendingRequests.size === 0 && worker.unref?.()) : reject(error);
          return;
        }
        pending && (this.pendingRequests.delete(id), pending.eventChain.then(
          () => {
            pending.resolve(message), this.pendingRequests.size === 0 && worker.unref?.();
          },
          (error) => {
            pending.reject(error), this.pendingRequests.size === 0 && worker.unref?.();
          }
        ));
      }, handleError = (errorLike) => {
        let message = this.options.loadErrorMessage?.(errorLike) ?? defaultLoadErrorMessage(errorLike), error = new Error(message);
        this.rejectReady = null, reject(error), this.terminate(error.message);
      };
      typeof worker.on == "function" ? (worker.on("message", handleMessage), worker.on("error", handleError)) : (worker.onmessage = (event) => handleMessage(event.data), worker.onerror = handleError), this.options.isReady || (this.rejectReady = null, resolve());
    }), worker;
  }
};
function defaultLoadErrorMessage(errorLike) {
  return `Worker failed to load: ${errorLike instanceof Error ? errorLike.message : errorLike.error instanceof Error ? errorLike.error.message : errorLike.message || "The runtime blocked or failed to load the worker module."}`;
}
var SolverWorkerExecutor = class {
  constructor(codec, createWorker, supportsSharedCancellation = !1) {
    this.codec = codec;
    this.supportsSharedCancellation = supportsSharedCancellation;
    this.nextRequestId = 1;
    this.activeJob = null;
    this.cancellation = null;
    this.solver = codec.solver, this.worker = new ManagedWorker({
      createWorker,
      isReady: (bytes) => {
        if (!(bytes instanceof Uint8Array)) return !1;
        let response = decodeSolverBridgeResponse(bytes);
        return response.solver === this.solver && response.payload.case === "ready";
      },
      getRequestId: (bytes) => decodeSolverBridgeRequest(bytes).requestId,
      getResponseId: (bytes) => bytes instanceof Uint8Array ? decodeSolverBridgeResponse(bytes).requestId : void 0,
      isEvent: (bytes) => {
        if (!(bytes instanceof Uint8Array)) return !1;
        let payload = decodeSolverBridgeResponse(bytes).payload.case;
        return payload === "eventPayload" || payload === "status";
      },
      handleMessage: (message) => message instanceof Uint8Array ? !1 : (this.cancellation = message, !0),
      loadErrorMessage: (error) => defaultLoadErrorMessage(error).replace("Worker", `${codec.label} worker`)
    });
  }
  execute(request, options) {
    if (this.activeJob) throw new SolverExecutorBusyError(this.codec.label);
    let requestId = this.nextRequestId++, state = {
      cancelled: !1,
      createdAtMs: BigInt(Date.now()),
      request
    };
    return this.activeJob = state, {
      requestId,
      result: this.run(requestId, request, options, state).finally(() => {
        this.activeJob === state && (this.activeJob = null);
      }),
      cancel: () => this.cancel(requestId, options, state)
    };
  }
  async load() {
    await this.worker.load();
  }
  terminate(reason) {
    this.worker.terminate(reason ?? `${this.codec.label} worker executor terminated.`);
  }
  async run(requestId, request, options, state) {
    let bytes = encodeSolverBridgeRequest({
      requestId,
      solver: this.solver,
      payload: this.codec.encodeRequest(request)
    }), failureHandled = !1;
    try {
      let resultBytes = await this.worker.post(bytes, async (eventBytes) => {
        if (!(eventBytes instanceof Uint8Array)) return;
        let outer2 = decodeSolverBridgeResponse(eventBytes);
        if (outer2.payload.case === "status")
          await options.onEvent({ type: "status", status: outer2.payload.value });
        else if (outer2.payload.case === "eventPayload") {
          let event = this.codec.decodeEvent?.(outer2.payload.value);
          event != null && await options.onEvent(event);
        }
      }, [bytes.buffer], () => {
        if (this.cancellation && Atomics.store(
          new Uint8Array(this.cancellation.memory),
          this.cancellation.byteOffset,
          0
        ), state.cancelled) throw state.error;
      });
      if (!(resultBytes instanceof Uint8Array))
        throw new Error(`${this.codec.label} worker returned an invalid message.`);
      if (state.cancelled) throw state.error;
      let outer = decodeSolverBridgeResponse(resultBytes);
      if (outer.payload.case === "failure") {
        failureHandled = !0, await options.onEvent({ type: "failure", failure: outer.payload.value });
        let error = new Error(outer.payload.value.message);
        throw outer.payload.value.trace && (error.stack = outer.payload.value.trace), error;
      }
      if (outer.payload.case !== "resultPayload")
        throw new Error(
          `${this.codec.label} worker returned unexpected response: ${outer.payload.case ?? "empty"}`
        );
      return this.codec.decodeResult(outer.payload.value);
    } catch (error) {
      throw state.cancelled ? (await options.onEvent(createSolverJobStatusEvent(
        this.solver,
        requestId,
        SolverJobState2.CANCELLED,
        state.createdAtMs
      )), state.error ?? error) : (failureHandled || await options.onEvent(createSolverFailureEvent(
        this.solver,
        requestId,
        error instanceof Error ? error.message : String(error),
        SolverFailureKind2.WORKER_CRASH,
        error instanceof Error ? error.stack ?? "" : "",
        !0
      )), error);
    }
  }
  async cancel(targetRequestId, options, state) {
    if (this.activeJob !== state || state.cancelled) return;
    if (state.cancelled = !0, state.error = new SolverJobCancelledError(this.codec.label, targetRequestId), await options.onEvent(createSolverJobStatusEvent(
      this.solver,
      targetRequestId,
      SolverJobState2.CANCELLING,
      state.createdAtMs
    )), !(typeof this.supportsSharedCancellation == "function" ? this.supportsSharedCancellation(state.request) : this.supportsSharedCancellation)) {
      this.worker.terminate(state.error);
      return;
    }
    if (await this.worker.load(), !this.cancellation)
      throw new Error(`${this.codec.label} worker did not provide a cancellation signal.`);
    Atomics.store(
      new Uint8Array(this.cancellation.memory),
      this.cancellation.byteOffset,
      1
    );
  }
};

// javascript/lib/generated/cp_sat_schemas.ts
var cpModelProtoSchema = `// Copyright 2010-2025 Google LLC
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Proto describing a general Constraint Programming (CP) problem.

syntax = "proto3";

package operations_research.sat;

option csharp_namespace = "Google.OrTools.Sat";
option go_package = "github.com/google/or-tools/ortools/sat/proto/cpmodel";
option java_package = "com.google.ortools.sat";
option java_multiple_files = true;
option java_outer_classname = "CpModelProtobuf";

// An integer variable.
//
// It will be referred to by an int32 corresponding to its index in a
// CpModelProto variables field.
//
// Depending on the context, a reference to a variable whose domain is in [0, 1]
// can also be seen as a Boolean that will be true if the variable value is 1
// and false if it is 0. When used in this context, the field name will always
// contain the word "literal".
//
// Negative reference (advanced usage): to simplify the creation of a model and
// for efficiency reasons, all the "literal" or "variable" fields can also
// contain a negative index. A negative index i will refer to the negation of
// the integer variable at index -i -1 or to NOT the literal at the same index.
//
// Ex: A variable index 4 will refer to the integer variable model.variables(4)
// and an index of -5 will refer to the negation of the same variable. A literal
// index 4 will refer to the logical fact that model.variable(4) == 1 and a
// literal index of -5 will refer to the logical fact model.variable(4) == 0.
message IntegerVariableProto {
  // For debug/logging only. Can be empty.
  string name = 1;

  // The variable domain given as a sorted list of n disjoint intervals
  // [min, max] and encoded as [min_0, max_0,  ..., min_{n-1}, max_{n-1}].
  //
  // The most common example being just [min, max].
  // If min == max, then this is a constant variable.
  //
  // We have:
  //  - domain_size() is always even.
  //  - min == domain.front();
  //  - max == domain.back();
  //  - for all i < n   :      min_i <= max_i
  //  - for all i < n-1 :  max_i + 1 < min_{i+1}.
  //
  // Note that we check at validation that a variable domain is small enough so
  // that we don't run into integer overflow in our algorithms. Because of that,
  // you cannot just have "unbounded" variable like [0, kint64max] and should
  // try to specify tighter domains.
  repeated int64 domain = 2;
}

// Argument of the constraints of the form OP(literals).
message BoolArgumentProto {
  repeated int32 literals = 1;
}

// Some constraints supports linear expression instead of just using a reference
// to a variable. This is especially useful during presolve to reduce the model
// size.
message LinearExpressionProto {
  repeated int32 vars = 1;
  repeated int64 coeffs = 2;
  int64 offset = 3;
}

message LinearArgumentProto {
  LinearExpressionProto target = 1;
  repeated LinearExpressionProto exprs = 2;
}

// All expressions must take different values.
message AllDifferentConstraintProto {
  repeated LinearExpressionProto exprs = 1;
}

// The linear sum vars[i] * coeffs[i] must fall in the given domain. The domain
// has the same format as the one in IntegerVariableProto.
//
// Note that the validation code currently checks using the domain of the
// involved variables that the sum can always be computed without integer
// overflow and throws an error otherwise.
message LinearConstraintProto {
  repeated int32 vars = 1;
  repeated int64 coeffs = 2;  // Same size as vars.
  repeated int64 domain = 3;
}

// The constraint linear_target = exprs[linear_index].
// This enforces that index takes one of the value in [0, vars_size()).
message ElementConstraintProto {
  int32 index = 1;          // Legacy field.
  int32 target = 2;         // Legacy field.
  repeated int32 vars = 3;  // Legacy field.
  LinearExpressionProto linear_index = 4;
  LinearExpressionProto linear_target = 5;
  repeated LinearExpressionProto exprs = 6;
}

// This is not really a constraint. It is there so it can be referred by other
// constraints using this "interval" concept.
//
// IMPORTANT: For now, this constraint do not enforce any relations on the
// components, and it is up to the client to add in the model:
// - enforcement => start + size == end.
// - enforcement => size >= 0  // Only needed if size is not already >= 0.
message IntervalConstraintProto {
  LinearExpressionProto start = 4;
  LinearExpressionProto end = 5;
  LinearExpressionProto size = 6;
}

// All the intervals (index of IntervalConstraintProto) must be disjoint. More
// formally, there must exist a sequence so that for each consecutive intervals,
// we have end_i <= start_{i+1}. In particular, intervals of size zero do matter
// for this constraint. This is also known as a disjunctive constraint in
// scheduling.
message NoOverlapConstraintProto {
  repeated int32 intervals = 1;
}

// The boxes defined by [start_x, end_x) * [start_y, end_y) cannot overlap.
// Furthermore, one box is optional if at least one of the x or y interval is
// optional.
//
// Note that the case of boxes of size zero is special. The following cases
// violate the constraint:
//   - a point box inside a box with a non zero area
//   - a line box overlapping a box with a non zero area
//   - one vertical line box crossing an horizontal line box.
message NoOverlap2DConstraintProto {
  repeated int32 x_intervals = 1;
  repeated int32 y_intervals = 2;  // Same size as x_intervals.
}

// The sum of the demands of the intervals at each interval point cannot exceed
// a capacity. Note that intervals are interpreted as [start, end) and as
// such intervals like [2,3) and [3,4) do not overlap for the point of view of
// this constraint. Moreover, intervals of size zero are ignored.
//
// All demands must not contain any negative value in their domains. This is
// checked at validation. Even if there are no intervals, this constraint
// implicit enforces capacity >= 0. In other words, a negative capacity is
// considered valid but always infeasible.
message CumulativeConstraintProto {
  LinearExpressionProto capacity = 1;
  repeated int32 intervals = 2;
  repeated LinearExpressionProto demands = 3;  // Same size as intervals.
}

// Maintain a reservoir level within bounds. The water level starts at 0, and at
// any time, it must be within [min_level, max_level].
//
// If the variable active_literals[i] is true, and if the expression
// time_exprs[i] is assigned a value t, then the current level changes by
// level_changes[i] at the time t. Therefore, at any time t:
//
// sum(level_changes[i] * active_literals[i] if time_exprs[i] <= t)
//   in [min_level, max_level]
//
// Note that min level must be <= 0, and the max level must be >= 0. Please use
// fixed level_changes to simulate initial state.
//
// The array of boolean variables 'actives', if defined, indicates which actions
// are actually performed. If this array is not defined, then it is assumed that
// all actions will be performed.
message ReservoirConstraintProto {
  int64 min_level = 1;
  int64 max_level = 2;
  repeated LinearExpressionProto time_exprs = 3;
  repeated LinearExpressionProto level_changes = 6;
  repeated int32 active_literals = 5;
  reserved 4;
}

// The circuit constraint is defined on a graph where the arc presence are
// controlled by literals. Each arc is given by an index in the
// tails/heads/literals lists that must have the same size.
//
// For now, we ignore node indices with no incident arc. All the other nodes
// must have exactly one incoming and one outgoing selected arc (i.e. literal at
// true). All the selected arcs that are not self-loops must form a single
// circuit. Note that multi-arcs are allowed, but only one of them will be true
// at the same time. Multi-self loop are disallowed though.
message CircuitConstraintProto {
  repeated int32 tails = 3;
  repeated int32 heads = 4;
  repeated int32 literals = 5;
}

// The "VRP" (Vehicle Routing Problem) constraint.
//
// The direct graph where arc #i (from tails[i] to head[i]) is present iff
// literals[i] is true must satisfy this set of properties:
// - #incoming arcs == 1 except for node 0.
// - #outgoing arcs == 1 except for node 0.
// - for node zero, #incoming arcs == #outgoing arcs.
// - There are no duplicate arcs.
// - Self-arcs are allowed except for node 0.
// - There is no cycle in this graph, except through node 0.
//
// Note: Currently this constraint expects all the nodes in [0, num_nodes) to
// have at least one incident arc. The model will be considered invalid if it
// is not the case. You can add self-arc fixed to one to ignore some nodes if
// needed.
//
// TODO(user): It is probably possible to generalize this constraint to a
// no-cycle in a general graph, or a no-cycle with sum incoming <= 1 and sum
// outgoing <= 1 (more efficient implementation). On the other hand, having this
// specific constraint allow us to add specific "cuts" to a VRP problem.
message RoutesConstraintProto {
  repeated int32 tails = 1;
  repeated int32 heads = 2;
  repeated int32 literals = 3;

  // DEPRECATED. These fields are no longer used. The solver ignores them.
  repeated int32 demands = 4;
  int64 capacity = 5;

  // A set of linear expressions associated with the nodes.
  message NodeExpressions {
    // The i-th element is the linear expression associated with the i-th node.
    repeated LinearExpressionProto exprs = 1;
  }

  // Expressions associated with the nodes of the graph, such as the load of the
  // vehicle arriving at a node, or the time at which a vehicle arrives at a
  // node. Expressions with the same "dimension" (such as "load" or "time") must
  // be listed together.
  // This field is optional. If it is set, the linear constraints of size 1 or 2
  // between the variables in these expressions will be used to derive cuts for
  // this constraint. If it is not set, the solver will try to automatically
  // derive it, from the linear constraints of size 1 or 2 in the model (this
  // can fail in complex cases).
  repeated NodeExpressions dimensions = 6;
}

// The values of the n-tuple formed by the given expression can only be one of
// the listed n-tuples in values. The n-tuples are encoded in a flattened way:
//     [tuple0_v0, tuple0_v1, ..., tuple0_v{n-1}, tuple1_v0, ...].
// Corner cases:
//  - If all \`vars\`, \`values\` and \`exprs\` are empty, the constraint is trivially
//    true, irrespective of the value of \`negated\`.
//  - If \`values\` is empty but either vars or exprs is not, the constraint is
//    trivially false if \`negated\` is false, and trivially true if \`negated\` is
//    true.
//  - If \`vars\` and \`exprs\` are empty but \`values\` is not, the model is invalid.
message TableConstraintProto {
  repeated int32 vars = 1;  // Legacy field.
  repeated int64 values = 2;
  repeated LinearExpressionProto exprs = 4;

  // If true, the meaning is "negated", that is we forbid any of the given
  // tuple from a feasible assignment.
  bool negated = 3;
}

// The two arrays of variable each represent a function, the second is the
// inverse of the first: f_direct[i] == j <=> f_inverse[j] == i.
message InverseConstraintProto {
  repeated int32 f_direct = 1;
  repeated int32 f_inverse = 2;
}

// This constraint forces a sequence of expressions to be accepted by an
// automaton.
message AutomatonConstraintProto {
  // A state is identified by a non-negative number. It is preferable to keep
  // all the states dense in says [0, num_states). The automaton starts at
  // starting_state and must finish in any of the final states.
  int64 starting_state = 2;
  repeated int64 final_states = 3;

  // List of transitions (all 3 vectors have the same size). Both tail and head
  // are states, label is any variable value. No two outgoing transitions from
  // the same state can have the same label.
  repeated int64 transition_tail = 4;
  repeated int64 transition_head = 5;
  repeated int64 transition_label = 6;

  // Legacy field.
  repeated int32 vars = 7;
  // The sequence of expressions. The automaton is ran for exprs_size() "steps"
  // and the value of exprs[i] corresponds to the transition label at step i.
  repeated LinearExpressionProto exprs = 8;
}

// A list of variables, without any semantics.
message ListOfVariablesProto {
  repeated int32 vars = 1;
}

// Next id: 31
message ConstraintProto {
  // For debug/logging only. Can be empty.
  string name = 1;

  // The constraint will be enforced iff all literals listed here are true. If
  // this is empty, then the constraint will always be enforced. An enforced
  // constraint must be satisfied, and an un-enforced one will simply be
  // ignored.
  //
  // This is also called half-reification. To have an equivalence between a
  // literal and a constraint (full reification), one must add both a constraint
  // (controlled by a literal l) and its negation (controlled by the negation of
  // l).
  //
  // Important: as of September 2025, some constraints might be less efficient
  // with enforcement than without: circuit, routes, no_overlap, no_overlap_2d,
  // and cumulative. If performance is not great, consider using a model without
  // these constraints enforced.
  repeated int32 enforcement_literal = 2;

  // The actual constraint with its arguments.
  oneof constraint {
    // The bool_or constraint forces at least one literal to be true.
    BoolArgumentProto bool_or = 3;

    // The bool_and constraint forces all of the literals to be true.
    //
    // This is a "redundant" constraint in the sense that this can easily be
    // encoded with many bool_or or at_most_one. It is just more space efficient
    // and handled slightly differently internally.
    BoolArgumentProto bool_and = 4;

    // The at_most_one constraint enforces that no more than one literal is
    // true at the same time.
    //
    // Note that an at most one constraint of length n could be encoded with n
    // bool_and constraint with n-1 term on the right hand side. So in a sense,
    // this constraint contribute directly to the "implication-graph" or the
    // 2-SAT part of the model.
    BoolArgumentProto at_most_one = 26;

    // The exactly_one constraint force exactly one literal to true and no more.
    //
    // Anytime a bool_or (it could have been called at_least_one) is included
    // into an at_most_one, then the bool_or is actually an exactly one
    // constraint, and the extra literal in the at_most_one can be set to false.
    // So in this sense, this constraint is not really needed. it is just here
    // for a better description of the problem structure and to facilitate some
    // algorithm.
    BoolArgumentProto exactly_one = 29;

    // The bool_xor constraint forces an odd number of the literals to be true.
    BoolArgumentProto bool_xor = 5;

    // The int_div constraint forces the target to equal exprs[0] / exprs[1].
    // The division is "rounded" towards zero, so we can have for instance
    // (2 = 12 / 5) or (-3 = -10 / 3). If you only want exact integer division,
    // then you should use instead of t = a / b, the int_prod constraint
    // a = b * t.
    //
    // If 0 belongs to the domain of exprs[1], then the model is deemed invalid.
    LinearArgumentProto int_div = 7;

    // The int_mod constraint forces the target to equal exprs[0] % exprs[1].
    // The domain of exprs[1] must be strictly positive. The sign of the target
    // is the same as the sign of exprs[0].
    LinearArgumentProto int_mod = 8;

    // The int_prod constraint forces the target to equal the product of all
    // variables. By convention, because we can just remove term equal to one,
    // the empty product forces the target to be one.
    //
    // Note that the solver checks for potential integer overflow. So the
    // product of the maximum absolute value of all the terms (using the initial
    // domain) should fit on an int64. Otherwise the model will be declared
    // invalid.
    LinearArgumentProto int_prod = 11;

    // The lin_max constraint forces the target to equal the maximum of all
    // linear expressions.
    // Note that this can model a minimum simply by negating all expressions.
    LinearArgumentProto lin_max = 27;

    // The linear constraint enforces a linear inequality among the variables,
    // such as 0 <= x + 2y <= 10.
    LinearConstraintProto linear = 12;

    // The all_diff constraint forces all variables to take different values.
    AllDifferentConstraintProto all_diff = 13;

    // The element constraint forces the variable with the given index
    // to be equal to the target.
    ElementConstraintProto element = 14;

    // The circuit constraint takes a graph and forces the arcs present
    // (with arc presence indicated by a literal) to form a unique cycle.
    CircuitConstraintProto circuit = 15;

    // The routes constraint implements the vehicle routing problem.
    RoutesConstraintProto routes = 23;

    // The table constraint enforces what values a tuple of variables may
    // take.
    TableConstraintProto table = 16;

    // The automaton constraint forces a sequence of variables to be accepted
    // by an automaton.
    AutomatonConstraintProto automaton = 17;

    // The inverse constraint forces two arrays to be inverses of each other:
    // the values of one are the indices of the other, and vice versa.
    InverseConstraintProto inverse = 18;

    // The reservoir constraint forces the sum of a set of active demands
    // to always be between a specified minimum and maximum value during
    // specific times.
    ReservoirConstraintProto reservoir = 24;

    // Constraints on intervals.
    //
    // The first constraint defines what an "interval" is and the other
    // constraints use references to it. All the intervals that have an
    // enforcement_literal set to false are ignored by these constraints.
    //
    // TODO(user): Explain what happen for intervals of size zero. Some
    // constraints ignore them; others do take them into account.

    // The interval constraint takes a start, end, and size, and forces
    // start + size == end.
    IntervalConstraintProto interval = 19;

    // The no_overlap constraint prevents a set of intervals from
    // overlapping; in scheduling, this is called a disjunctive
    // constraint.
    NoOverlapConstraintProto no_overlap = 20;

    // The no_overlap_2d constraint prevents a set of boxes from overlapping.
    NoOverlap2DConstraintProto no_overlap_2d = 21;

    // The cumulative constraint ensures that for any integer point, the sum
    // of the demands of the intervals containing that point does not exceed
    // the capacity.
    CumulativeConstraintProto cumulative = 22;

    // This constraint is not meant to be used and will be rejected by the
    // solver. It is meant to mark variable when testing the presolve code.
    ListOfVariablesProto dummy_constraint = 30;
  }
}

// Optimization objective.
message CpObjectiveProto {
  // The linear terms of the objective to minimize.
  // For a maximization problem, one can negate all coefficients in the
  // objective and set scaling_factor to -1.
  repeated int32 vars = 1;
  repeated int64 coeffs = 4;

  // The displayed objective is always:
  //   scaling_factor * (sum(coefficients[i] * objective_vars[i]) + offset).
  // This is needed to have a consistent objective after presolve or when
  // scaling a double problem to express it with integers.
  //
  // Note that if scaling_factor is zero, then it is assumed to be 1, so that by
  // default these fields have no effect.
  double offset = 2;
  double scaling_factor = 3;

  // If non-empty, only look for an objective value in the given domain.
  // Note that this does not depend on the offset or scaling factor, it is a
  // domain on the sum of the objective terms only.
  repeated int64 domain = 5;

  // Internal field. Do not set. When we scale a FloatObjectiveProto to a
  // integer version, we set this to true if the scaling was exact (i.e. all
  // original coeff were integer for instance).
  //
  // TODO(user): Put the error bounds we computed instead?
  bool scaling_was_exact = 6;

  // Internal fields to recover a bound on the original integer objective from
  // the presolved one. Basically, initially the integer objective fit on an
  // int64 and is in [Initial_lb, Initial_ub]. During presolve, we might change
  // the linear expression to have a new domain [Presolved_lb, Presolved_ub]
  // that will also always fit on an int64.
  //
  // The two domain will always be linked with an affine transformation between
  // the two of the form:
  //   old = (new + before_offset) * integer_scaling_factor + after_offset.
  // Note that we use both offsets to always be able to do the computation while
  // staying in the int64 domain. In particular, the after_offset will always
  // be in (-integer_scaling_factor, integer_scaling_factor).
  int64 integer_before_offset = 7;
  int64 integer_after_offset = 9;
  int64 integer_scaling_factor = 8;
}

// A linear floating point objective: sum coeffs[i] * vars[i] + offset.
// Note that the variable can only still take integer value.
message FloatObjectiveProto {
  repeated int32 vars = 1;
  repeated double coeffs = 2;
  double offset = 3;

  // The optimization direction. The default is to minimize
  bool maximize = 4;
}

// Define the strategy to follow when the solver needs to take a new decision.
// Note that this strategy is only defined on a subset of variables.
message DecisionStrategyProto {
  // The variables to be considered for the next decision. The order matter and
  // is always used as a tie-breaker after the variable selection strategy
  // criteria defined below.
  repeated int32 variables = 1;

  // If this is set, then the variables field must be empty.
  // We currently only support affine expression.
  //
  // Note that this is needed so that if a variable has an affine
  // representative, we can properly transform a DecisionStrategyProto through
  // presolve.
  repeated LinearExpressionProto exprs = 5;

  // The order in which the variables (resp. affine expression) above should be
  // considered. Note that only variables that are not already fixed are
  // considered.
  //
  // TODO(user): extend as needed.
  enum VariableSelectionStrategy {
    CHOOSE_FIRST = 0;
    CHOOSE_LOWEST_MIN = 1;
    CHOOSE_HIGHEST_MAX = 2;
    CHOOSE_MIN_DOMAIN_SIZE = 3;
    CHOOSE_MAX_DOMAIN_SIZE = 4;
  }
  VariableSelectionStrategy variable_selection_strategy = 2;

  // Once a variable (resp. affine expression) has been chosen, this enum
  // describe what decision is taken on its domain.
  //
  // TODO(user): extend as needed.
  enum DomainReductionStrategy {
    SELECT_MIN_VALUE = 0;
    SELECT_MAX_VALUE = 1;
    SELECT_LOWER_HALF = 2;
    SELECT_UPPER_HALF = 3;
    SELECT_MEDIAN_VALUE = 4;
    SELECT_RANDOM_HALF = 5;
  }
  DomainReductionStrategy domain_reduction_strategy = 3;
}

// This message encodes a partial (or full) assignment of the variables of a
// CpModelProto. The variable indices should be unique and valid variable
// indices.
message PartialVariableAssignment {
  repeated int32 vars = 1;
  repeated int64 values = 2;
}

// A permutation of integers encoded as a list of cycles, hence the "sparse"
// format. The image of an element cycle[i] is cycle[(i + 1) % cycle_length].
message SparsePermutationProto {
  // Each cycle is listed one after the other in the support field.
  // The size of each cycle is given (in order) in the cycle_sizes field.
  repeated int32 support = 1;
  repeated int32 cycle_sizes = 2;
}

// A dense matrix of numbers encoded in a flat way, row by row.
// That is matrix[i][j] = entries[i * num_cols + j];
message DenseMatrixProto {
  int32 num_rows = 1;
  int32 num_cols = 2;
  repeated int32 entries = 3;
}

// EXPERIMENTAL. For now, this is meant to be used by the solver and not filled
// by clients.
//
// Hold symmetry information about the set of feasible solutions. If we permute
// the variable values of any feasible solution using one of the permutation
// described here, we should always get another feasible solution.
//
// We usually also enforce that the objective of the new solution is the same.
//
// The group of permutations encoded here is usually computed from the encoding
// of the model, so it is not meant to be a complete representation of the
// feasible solution symmetries, just a valid subgroup.
message SymmetryProto {
  // A list of variable indices permutations that leave the feasible space of
  // solution invariant. Usually, we only encode a set of generators of the
  // group.
  repeated SparsePermutationProto permutations = 1;

  // An orbitope is a special symmetry structure of the solution space. If the
  // variable indices are arranged in a matrix (with no duplicates), then any
  // permutation of the columns will be a valid permutation of the feasible
  // space.
  //
  // This arise quite often. The typical example is a graph coloring problem
  // where for each node i, you have j booleans to indicate its color. If the
  // variables color_of_i_is_j are arranged in a matrix[i][j], then any columns
  // permutations leave the problem invariant.
  repeated DenseMatrixProto orbitopes = 2;
}

// A constraint programming problem.
message CpModelProto {
  // For debug/logging only. Can be empty.
  string name = 1;

  // The associated Protos should be referred by their index in these fields.
  repeated IntegerVariableProto variables = 2;
  repeated ConstraintProto constraints = 3;

  // The objective to minimize. Can be empty for pure decision problems.
  CpObjectiveProto objective = 4;

  // Advanced usage.
  // It is invalid to have both an objective and a floating point objective.
  //
  // The objective of the model, in floating point format. The solver will
  // automatically scale this to integer during expansion and thus convert it to
  // a normal CpObjectiveProto. See the mip* parameters to control how this is
  // scaled. In most situation the precision will be good enough, but you can
  // see the logs to see what are the precision guaranteed when this is
  // converted to a fixed point representation.
  //
  // Note that even if the precision is bad, the returned objective_value and
  // best_objective_bound will be computed correctly. So at the end of the solve
  // you can check the gap if you only want precise optimal.
  FloatObjectiveProto floating_point_objective = 9;

  // Defines the strategy that the solver should follow when the
  // search_branching parameter is set to FIXED_SEARCH. Note that this strategy
  // is also used as a heuristic when we are not in fixed search.
  //
  // Advanced Usage: if not all variables appears and the parameter
  // "instantiate_all_variables" is set to false, then the solver will not try
  // to instantiate the variables that do not appear. Thus, at the end of the
  // search, not all variables may be fixed. Currently, we will set them to
  // their lower bound in the solution.
  repeated DecisionStrategyProto search_strategy = 5;

  // Solution hint.
  //
  // If a feasible or almost-feasible solution to the problem is already known,
  // it may be helpful to pass it to the solver so that it can be used. The
  // solver will try to use this information to create its initial feasible
  // solution.
  //
  // Note that it may not always be faster to give a hint like this to the
  // solver. There is also no guarantee that the solver will use this hint or
  // try to return a solution "close" to this assignment in case of multiple
  // optimal solutions.
  PartialVariableAssignment solution_hint = 6;

  // A list of literals. The model will be solved assuming all these literals
  // are true. Compared to just fixing the domain of these literals, using this
  // mechanism is slower but allows in case the model is INFEASIBLE to get a
  // potentially small subset of them that can be used to explain the
  // infeasibility.
  //
  // Think (IIS), except when you are only concerned by the provided
  // assumptions. This is powerful as it allows to group a set of logically
  // related constraint under only one enforcement literal which can potentially
  // give you a good and interpretable explanation for infeasiblity.
  //
  // Such infeasibility explanation will be available in the
  // sufficient_assumptions_for_infeasibility response field.
  repeated int32 assumptions = 7;

  // For now, this is not meant to be filled by a client writing a model, but
  // by our preprocessing step.
  //
  // Information about the symmetries of the feasible solution space.
  // These usually leaves the objective invariant.
  SymmetryProto symmetry = 8;
}

// The status returned by a solver trying to solve a CpModelProto.
enum CpSolverStatus {
  // The status of the model is still unknown. A search limit has been reached
  // before any of the statuses below could be determined.
  UNKNOWN = 0;

  // The given CpModelProto didn't pass the validation step. You can get a
  // detailed error by calling ValidateCpModel(model_proto).
  MODEL_INVALID = 1;

  // A feasible solution has been found. But the search was stopped before we
  // could prove optimality or before we enumerated all solutions of a
  // feasibility problem (if asked).
  FEASIBLE = 2;

  // The problem has been proven infeasible.
  INFEASIBLE = 3;

  // An optimal feasible solution has been found.
  //
  // More generally, this status represent a success. So we also return OPTIMAL
  // if we find a solution for a pure feasibility problem or if a gap limit has
  // been specified and we return a solution within this limit. In the case
  // where we need to return all the feasible solution, this status will only be
  // returned if we enumerated all of them; If we stopped before, we will return
  // FEASIBLE.
  OPTIMAL = 4;
}

// Just a message used to store dense solution.
// This is used by the additional_solutions field.
message CpSolverSolution {
  repeated int64 values = 1;
}

// The response returned by a solver trying to solve a CpModelProto.
//
// Next id: 32
message CpSolverResponse {
  // The status of the solve.
  CpSolverStatus status = 1;

  // A feasible solution to the given problem. Depending on the returned status
  // it may be optimal or just feasible. This is in one-to-one correspondence
  // with a CpModelProto::variables repeated field and list the values of all
  // the variables.
  repeated int64 solution = 2;

  // Only make sense for an optimization problem. The objective value of the
  // returned solution if it is non-empty. If there is no solution, then for a
  // minimization problem, this will be an upper-bound of the objective of any
  // feasible solution, and a lower-bound for a maximization problem.
  double objective_value = 3;

  // Only make sense for an optimization problem. A proven lower-bound on the
  // objective for a minimization problem, or a proven upper-bound for a
  // maximization problem.
  double best_objective_bound = 4;

  // If the parameter fill_additional_solutions_in_response is set, then we
  // copy all the solutions from our internal solution pool here.
  //
  // Note that the one returned in the solution field will likely appear here
  // too. Do not rely on the solutions order as it depends on our internal
  // representation (after postsolve).
  repeated CpSolverSolution additional_solutions = 27;

  // Advanced usage.
  //
  // If the option fill_tightened_domains_in_response is set, then this field
  // will be a copy of the CpModelProto.variables where each domain has been
  // reduced using the information the solver was able to derive. Note that this
  // is only filled with the info derived during a normal search and we do not
  // have any dedicated algorithm to improve it.
  //
  // Warning: if you didn't set keep_all_feasible_solutions_in_presolve, then
  // these domains might exclude valid feasible solution. Otherwise for a
  // feasibility problem, all feasible solution should be there.
  //
  // Warning: For an optimization problem, these will correspond to valid bounds
  // for the problem of finding an improving solution to the best one found so
  // far. It might be better to solve a feasibility version if one just want to
  // explore the feasible region.
  repeated IntegerVariableProto tightened_variables = 21;

  // A subset of the model "assumptions" field. This will only be filled if the
  // status is INFEASIBLE. This subset of assumption will be enough to still get
  // an infeasible problem.
  //
  // This is related to what is called the irreducible inconsistent subsystem or
  // IIS. Except one is only concerned by the provided assumptions. There is
  // also no guarantee that we return an irreducible (aka minimal subset).
  // However, this is based on SAT explanation and there is a good chance it is
  // not too large.
  //
  // If you really want a minimal subset, a possible way to get one is by
  // changing your model to minimize the number of assumptions at false, but
  // this is likely an harder problem to solve.
  //
  // Important: Currently, this is minimized only in single-thread and if the
  // problem is not an optimization problem, otherwise, it will always include
  // all the assumptions.
  //
  // TODO(user): Allows for returning multiple core at once.
  repeated int32 sufficient_assumptions_for_infeasibility = 23;

  // Contains the integer objective optimized internally. This is only filled if
  // the problem had a floating point objective, and on the final response, not
  // the ones given to callbacks.
  CpObjectiveProto integer_objective = 28;

  // Advanced usage.
  //
  // A lower bound on the integer expression of the objective. This is either a
  // bound on the expression in the returned integer_objective or on the integer
  // expression of the original objective if the problem already has an integer
  // objective.
  //
  // TODO(user): This should be renamed integer_objective_lower_bound.
  int64 inner_objective_lower_bound = 29;

  // Some statistics about the solve.
  //
  // Important: in multithread, this correspond the statistics of the first
  // subsolver. Which is usually the one with the user defined parameters. Or
  // the default-search if none are specified.
  int64 num_integers = 30;
  int64 num_booleans = 10;
  int64 num_fixed_booleans = 31;
  int64 num_conflicts = 11;
  int64 num_branches = 12;
  int64 num_binary_propagations = 13;
  int64 num_integer_propagations = 14;
  int64 num_restarts = 24;
  int64 num_lp_iterations = 25;

  // The time counted from the beginning of the Solve() call.
  double wall_time = 15;
  double user_time = 16;
  double deterministic_time = 17;

  // The integral of log(1 + absolute_objective_gap) over time.
  double gap_integral = 22;

  // Additional information about how the solution was found. It also stores
  // model or parameters errors that caused the model to be invalid.
  string solution_info = 20;

  // The solve log will be filled if the parameter log_to_response is set to
  // true.
  string solve_log = 26;
}
`, satParametersProtoSchema = `// Copyright 2010-2025 Google LLC
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// LINT: LEGACY_NAMES
syntax = "proto2";

package operations_research.sat;

option csharp_namespace = "Google.OrTools.Sat";
option go_package = "github.com/google/or-tools/ortools/sat/proto/satparameters";
option java_package = "com.google.ortools.sat";
option java_multiple_files = true;

// Contains the definitions for all the sat algorithm parameters and their
// default values.
//
// NEXT TAG: 356
message SatParameters {
  // In some context, like in a portfolio of search, it makes sense to name a
  // given parameters set for logging purpose.
  optional string name = 171 [default = ""];

  // ==========================================================================
  // Branching and polarity
  // ==========================================================================

  // Variables without activity (i.e. at the beginning of the search) will be
  // tried in this preferred order.
  enum VariableOrder {
    IN_ORDER = 0;  // As specified by the problem.
    IN_REVERSE_ORDER = 1;
    IN_RANDOM_ORDER = 2;
  }
  optional VariableOrder preferred_variable_order = 1 [default = IN_ORDER];

  // Specifies the initial polarity (true/false) when the solver branches on a
  // variable. This can be modified later by the user, or the phase saving
  // heuristic.
  //
  // Note(user): POLARITY_FALSE is usually a good choice because of the
  // "natural" way to express a linear boolean problem.
  enum Polarity {
    POLARITY_TRUE = 0;
    POLARITY_FALSE = 1;
    POLARITY_RANDOM = 2;
  }
  optional Polarity initial_polarity = 2 [default = POLARITY_FALSE];

  // If this is true, then the polarity of a variable will be the last value it
  // was assigned to, or its default polarity if it was never assigned since the
  // call to ResetDecisionHeuristic().
  //
  // Actually, we use a newer version where we follow the last value in the
  // longest non-conflicting partial assignment in the current phase.
  //
  // This is called 'literal phase saving'. For details see 'A Lightweight
  // Component Caching Scheme for Satisfiability Solvers' K. Pipatsrisawat and
  // A.Darwiche, In 10th International Conference on Theory and Applications of
  // Satisfiability Testing, 2007.
  optional bool use_phase_saving = 44 [default = true];

  // If non-zero, then we change the polarity heuristic after that many number
  // of conflicts in an arithmetically increasing fashion. So x the first time,
  // 2 * x the second time, etc...
  optional int32 polarity_rephase_increment = 168 [default = 1000];

  // If true and we have first solution LS workers, tries in some phase to
  // follow a LS solutions that violates has litle constraints as possible.
  optional bool polarity_exploit_ls_hints = 309 [default = false];

  // The proportion of polarity chosen at random. Note that this take
  // precedence over the phase saving heuristic. This is different from
  // initial_polarity:POLARITY_RANDOM because it will select a new random
  // polarity each time the variable is branched upon instead of selecting one
  // initially and then always taking this choice.
  optional double random_polarity_ratio = 45 [default = 0.0];

  // A number between 0 and 1 that indicates the proportion of branching
  // variables that are selected randomly instead of choosing the first variable
  // from the given variable_ordering strategy.
  optional double random_branches_ratio = 32 [default = 0.0];

  // Whether we use the ERWA (Exponential Recency Weighted Average) heuristic as
  // described in "Learning Rate Based Branching Heuristic for SAT solvers",
  // J.H.Liang, V. Ganesh, P. Poupart, K.Czarnecki, SAT 2016.
  optional bool use_erwa_heuristic = 75 [default = false];

  // The initial value of the variables activity. A non-zero value only make
  // sense when use_erwa_heuristic is true. Experiments with a value of 1e-2
  // together with the ERWA heuristic showed slighthly better result than simply
  // using zero. The idea is that when the "learning rate" of a variable becomes
  // lower than this value, then we prefer to branch on never explored before
  // variables. This is not in the ERWA paper.
  optional double initial_variables_activity = 76 [default = 0.0];

  // When this is true, then the variables that appear in any of the reason of
  // the variables in a conflict have their activity bumped. This is addition to
  // the variables in the conflict, and the one that were used during conflict
  // resolution.
  optional bool also_bump_variables_in_conflict_reasons = 77 [default = false];

  // ==========================================================================
  // Conflict analysis
  // ==========================================================================

  // Do we try to minimize conflicts (greedily) when creating them.
  enum ConflictMinimizationAlgorithm {
    reserved 3;
    NONE = 0;
    SIMPLE = 1;
    RECURSIVE = 2;
  }
  optional ConflictMinimizationAlgorithm minimization_algorithm = 4
      [default = RECURSIVE];

  // Whether to expoit the binary clause to minimize learned clauses further.
  enum BinaryMinizationAlgorithm {
    reserved 2, 3, 4;
    NO_BINARY_MINIMIZATION = 0;
    BINARY_MINIMIZATION_FROM_UIP = 1;
    BINARY_MINIMIZATION_FROM_UIP_AND_DECISIONS = 5;
  }
  optional BinaryMinizationAlgorithm binary_minimization_algorithm = 34
      [default = BINARY_MINIMIZATION_FROM_UIP_AND_DECISIONS];

  // At a really low cost, during the 1-UIP conflict computation, it is easy to
  // detect if some of the involved reasons are subsumed by the current
  // conflict. When this is true, such clauses are detached and later removed
  // from the problem.
  optional bool subsumption_during_conflict_analysis = 56 [default = true];

  // It is possible that "intermediate" clauses during conflict resolution
  // subsumes some of the clauses that propagated. This is quite cheap to detect
  // and result in more subsumption/strengthening of clauses.
  optional bool extra_subsumption_during_conflict_analysis = 351
      [default = true];

  // Try even more subsumption options during conflict analysis.
  optional bool decision_subsumption_during_conflict_analysis = 353
      [default = true];

  // If >=0, each time we have a conflict, we try to subsume the last n learned
  // clause with it.
  optional int32 eagerly_subsume_last_n_conflicts = 343 [default = 4];

  // If we remove clause that we now are "implied" by others. Note that this
  // might not always be good as we might loose some propagation power.
  optional bool subsume_during_vivification = 355 [default = true];

  // If true, try to backtrack as little as possible on conflict and re-imply
  // the clauses later.
  // This means we discard less propagation than traditional backjumping, but
  // requites additional bookkeeping to handle reimplication.
  // See: https://doi.org/10.1007/978-3-319-94144-8_7
  optional bool use_chronological_backtracking = 330 [default = false];

  // If chronological backtracking is enabled, this is the maximum number of
  // levels we will backjump over, otherwise we will backtrack.
  optional int32 max_backjump_levels = 331 [default = 50];

  // If chronological backtracking is enabled, this is the minimum number of
  // conflicts before we will consider backjumping.
  optional int32 chronological_backtrack_min_conflicts = 332 [default = 1000];

  // ==========================================================================
  // Clause database management
  // ==========================================================================

  // Trigger a cleanup when this number of "deletable" clauses is learned.
  optional int32 clause_cleanup_period = 11 [default = 10000];

  // Increase clause_cleanup_period by this amount after each cleanup.
  optional int32 clause_cleanup_period_increment = 337 [default = 0];

  // During a cleanup, we will always keep that number of "deletable" clauses.
  // Note that this doesn't include the "protected" clauses.
  optional int32 clause_cleanup_target = 13 [default = 0];

  // During a cleanup, if clause_cleanup_target is 0, we will delete the
  // clause_cleanup_ratio of "deletable" clauses instead of aiming for a fixed
  // target of clauses to keep.
  optional double clause_cleanup_ratio = 190 [default = 0.5];

  // All the clauses with a LBD (literal blocks distance) lower or equal to this
  // parameters will always be kept.
  //
  // Note that the LBD of a clause that just propagated is 1 + number of
  // different decision levels of its literals. So that the "classic" LBD of a
  // learned conflict is the same as its LBD when we backjump and then propagate
  // it.
  optional int32 clause_cleanup_lbd_bound = 59 [default = 5];

  // All the clause with a LBD lower or equal to this will be kept except if
  // its activity hasn't been bumped in the last 32 cleanup phase. Note that
  // this has no effect if it is <= clause_cleanup_lbd_bound.
  optional int32 clause_cleanup_lbd_tier1 = 349 [default = 0];

  // All the clause with a LBD lower or equal to this will be kept except if its
  // activity hasn't been bumped since the previous cleanup phase. Note that
  // this has no effect if it is <= clause_cleanup_lbd_bound or <=
  // clause_cleanup_lbd_tier1.
  optional int32 clause_cleanup_lbd_tier2 = 350 [default = 0];

  // The clauses that will be kept during a cleanup are the ones that come
  // first under this order. We always keep or exclude ties together.
  enum ClauseOrdering {
    // Order clause by decreasing activity, then by increasing LBD.
    CLAUSE_ACTIVITY = 0;
    // Order clause by increasing LBD, then by decreasing activity.
    CLAUSE_LBD = 1;
  }
  optional ClauseOrdering clause_cleanup_ordering = 60
      [default = CLAUSE_ACTIVITY];

  // Same as for the clauses, but for the learned pseudo-Boolean constraints.
  optional int32 pb_cleanup_increment = 46 [default = 200];
  optional double pb_cleanup_ratio = 47 [default = 0.5];

  // ==========================================================================
  // Variable and clause activities
  // ==========================================================================

  // Each time a conflict is found, the activities of some variables are
  // increased by one. Then, the activity of all variables are multiplied by
  // variable_activity_decay.
  //
  // To implement this efficiently, the activity of all the variables is not
  // decayed at each conflict. Instead, the activity increment is multiplied by
  // 1 / decay. When an activity reach max_variable_activity_value, all the
  // activity are multiplied by 1 / max_variable_activity_value.
  optional double variable_activity_decay = 15 [default = 0.8];
  optional double max_variable_activity_value = 16 [default = 1e100];

  // The activity starts at 0.8 and increment by 0.01 every 5000 conflicts until
  // 0.95. This "hack" seems to work well and comes from:
  //
  // Glucose 2.3 in the SAT 2013 Competition - SAT Competition 2013
  // http://edacc4.informatik.uni-ulm.de/SC13/solver-description-download/136
  optional double glucose_max_decay = 22 [default = 0.95];
  optional double glucose_decay_increment = 23 [default = 0.01];
  optional int32 glucose_decay_increment_period = 24 [default = 5000];

  // Clause activity parameters (same effect as the one on the variables).
  optional double clause_activity_decay = 17 [default = 0.999];
  optional double max_clause_activity_value = 18 [default = 1e20];

  // ==========================================================================
  // Restart
  // ==========================================================================

  // Restart algorithms.
  //
  // A reference for the more advanced ones is:
  // Gilles Audemard, Laurent Simon, "Refining Restarts Strategies for SAT
  // and UNSAT", Principles and Practice of Constraint Programming Lecture
  // Notes in Computer Science 2012, pp 118-126
  enum RestartAlgorithm {
    NO_RESTART = 0;

    // Just follow a Luby sequence times restart_period.
    LUBY_RESTART = 1;

    // Moving average restart based on the decision level of conflicts.
    DL_MOVING_AVERAGE_RESTART = 2;

    // Moving average restart based on the LBD of conflicts.
    LBD_MOVING_AVERAGE_RESTART = 3;

    // Fixed period restart every restart period.
    FIXED_RESTART = 4;
  }

  // The restart strategies will change each time the strategy_counter is
  // increased. The current strategy will simply be the one at index
  // strategy_counter modulo the number of strategy. Note that if this list
  // includes a NO_RESTART, nothing will change when it is reached because the
  // strategy_counter will only increment after a restart.
  //
  // The idea of switching of search strategy tailored for SAT/UNSAT comes from
  // Chanseok Oh with his COMiniSatPS solver, see http://cs.nyu.edu/~chanseok/.
  // But more generally, it seems REALLY beneficial to try different strategy.
  repeated RestartAlgorithm restart_algorithms = 61;
  optional string default_restart_algorithms = 70
      [default =
           "LUBY_RESTART,LBD_MOVING_AVERAGE_RESTART,DL_MOVING_AVERAGE_RESTART"];

  // Restart period for the FIXED_RESTART strategy. This is also the multiplier
  // used by the LUBY_RESTART strategy.
  optional int32 restart_period = 30 [default = 50];

  // Size of the window for the moving average restarts.
  optional int32 restart_running_window_size = 62 [default = 50];

  // In the moving average restart algorithms, a restart is triggered if the
  // window average times this ratio is greater that the global average.
  optional double restart_dl_average_ratio = 63 [default = 1.0];
  optional double restart_lbd_average_ratio = 71 [default = 1.0];

  // Block a moving restart algorithm if the trail size of the current conflict
  // is greater than the multiplier times the moving average of the trail size
  // at the previous conflicts.
  optional bool use_blocking_restart = 64 [default = false];
  optional int32 blocking_restart_window_size = 65 [default = 5000];
  optional double blocking_restart_multiplier = 66 [default = 1.4];

  // After each restart, if the number of conflict since the last strategy
  // change is greater that this, then we increment a "strategy_counter" that
  // can be use to change the search strategy used by the following restarts.
  optional int32 num_conflicts_before_strategy_changes = 68 [default = 0];

  // The parameter num_conflicts_before_strategy_changes is increased by that
  // much after each strategy change.
  optional double strategy_change_increase_ratio = 69 [default = 0.0];

  // ==========================================================================
  // Limits
  // ==========================================================================

  // Maximum time allowed in seconds to solve a problem.
  // The counter will starts at the beginning of the Solve() call.
  optional double max_time_in_seconds = 36 [default = inf];

  // Maximum time allowed in deterministic time to solve a problem.
  // The deterministic time should be correlated with the real time used by the
  // solver, the time unit being as close as possible to a second.
  optional double max_deterministic_time = 67 [default = inf];

  // Stops after that number of batches has been scheduled. This only make sense
  // when interleave_search is true.
  optional int32 max_num_deterministic_batches = 291 [default = 0];

  // Maximum number of conflicts allowed to solve a problem.
  //
  // TODO(user): Maybe change the way the conflict limit is enforced?
  // currently it is enforced on each independent internal SAT solve, rather
  // than on the overall number of conflicts across all solves. So in the
  // context of an optimization problem, this is not really usable directly by a
  // client.
  optional int64 max_number_of_conflicts = 37
      [default = 0x7FFFFFFFFFFFFFFF];  // kint64max

  // Maximum memory allowed for the whole thread containing the solver. The
  // solver will abort as soon as it detects that this limit is crossed. As a
  // result, this limit is approximative, but usually the solver will not go too
  // much over.
  //
  // TODO(user): This is only used by the pure SAT solver, generalize to CP-SAT.
  optional int64 max_memory_in_mb = 40 [default = 10000];

  // Stop the search when the gap between the best feasible objective (O) and
  // our best objective bound (B) is smaller than a limit.
  // The exact definition is:
  // - Absolute: abs(O - B)
  // - Relative: abs(O - B) / max(1, abs(O)).
  //
  // Important: The relative gap depends on the objective offset! If you
  // artificially shift the objective, you will get widely different value of
  // the relative gap.
  //
  // Note that if the gap is reached, the search status will be OPTIMAL. But
  // one can check the best objective bound to see the actual gap.
  //
  // If the objective is integer, then any absolute gap < 1 will lead to a true
  // optimal. If the objective is floating point, a gap of zero make little
  // sense so is is why we use a non-zero default value. At the end of the
  // search, we will display a warning if OPTIMAL is reported yet the gap is
  // greater than this absolute gap.
  optional double absolute_gap_limit = 159 [default = 1e-4];
  optional double relative_gap_limit = 160 [default = 0.0];

  // ==========================================================================
  // Other parameters
  // ==========================================================================

  // At the beginning of each solve, the random number generator used in some
  // part of the solver is reinitialized to this seed. If you change the random
  // seed, the solver may make different choices during the solving process.
  //
  // For some problems, the running time may vary a lot depending on small
  // change in the solving algorithm. Running the solver with different seeds
  // enables to have more robust benchmarks when evaluating new features.
  optional int32 random_seed = 31 [default = 1];

  // This is mainly here to test the solver variability. Note that in tests, if
  // not explicitly set to false, all 3 options will be set to true so that
  // clients do not rely on the solver returning a specific solution if they are
  // many equivalent optimal solutions.
  optional bool permute_variable_randomly = 178 [default = false];
  optional bool permute_presolve_constraint_order = 179 [default = false];
  optional bool use_absl_random = 180 [default = false];

  // Whether the solver should log the search progress. This is the maing
  // logging parameter and if this is false, none of the logging (callbacks,
  // log_to_stdout, log_to_response, ...) will do anything.
  optional bool log_search_progress = 41 [default = false];

  // Whether the solver should display per sub-solver search statistics.
  // This is only useful is log_search_progress is set to true, and if the
  // number of search workers is > 1. Note that in all case we display a bit
  // of stats with one line per subsolver.
  optional bool log_subsolver_statistics = 189 [default = false];

  // Add a prefix to all logs.
  optional string log_prefix = 185 [default = ""];

  // Log to stdout.
  optional bool log_to_stdout = 186 [default = true];

  // Log to response proto.
  optional bool log_to_response = 187 [default = false];

  // Experimental.
  //
  // This is an old experiment, it might cause crashes in multi-thread and you
  // should double check the solver result. It can still be used if you only
  // care about feasible solutions (these are checked) and it gives good result
  // on your problem. We might revive it at some point.
  //
  // Whether to use pseudo-Boolean resolution to analyze a conflict. Note that
  // this option only make sense if your problem is modelized using
  // pseudo-Boolean constraints. If you only have clauses, this shouldn't change
  // anything (except slow the solver down).
  optional bool use_pb_resolution = 43 [default = false];

  // A different algorithm during PB resolution. It minimizes the number of
  // calls to ReduceCoefficients() which can be time consuming. However, the
  // search space will be different and if the coefficients are large, this may
  // lead to integer overflows that could otherwise be prevented.
  optional bool minimize_reduction_during_pb_resolution = 48 [default = false];

  // Whether or not the assumption levels are taken into account during the LBD
  // computation. According to the reference below, not counting them improves
  // the solver in some situation. Note that this only impact solves under
  // assumptions.
  //
  // Gilles Audemard, Jean-Marie Lagniez, Laurent Simon, "Improving Glucose for
  // Incremental SAT Solving with Assumptions: Application to MUS Extraction"
  // Theory and Applications of Satisfiability Testing - SAT 2013, Lecture Notes
  // in Computer Science Volume 7962, 2013, pp 309-317.
  optional bool count_assumption_levels_in_lbd = 49 [default = true];

  // ==========================================================================
  // Presolve
  // ==========================================================================

  // During presolve, only try to perform the bounded variable elimination (BVE)
  // of a variable x if the number of occurrences of x times the number of
  // occurrences of not(x) is not greater than this parameter.
  optional int32 presolve_bve_threshold = 54 [default = 500];

  // Internal parameter. During BVE, if we eliminate a variable x, by default we
  // will push all clauses containing x and all clauses containing not(x) to the
  // postsolve. However, it is possible to write the postsolve code so that only
  // one such set is needed. The idea is that, if we push the set containing a
  // literal l, is to set l to false except if it is needed to satisfy one of
  // the clause in the set. This is always beneficial, but for historical
  // reason, not all our postsolve algorithm support this.
  optional bool filter_sat_postsolve_clauses = 324 [default = false];

  // During presolve, we apply BVE only if this weight times the number of
  // clauses plus the number of clause literals is not increased.
  optional int32 presolve_bve_clause_weight = 55 [default = 3];

  // The maximum "deterministic" time limit to spend in probing. A value of
  // zero will disable the probing.
  //
  // TODO(user): Clean up. The first one is used in CP-SAT, the other in pure
  // SAT presolve.
  optional double probing_deterministic_time_limit = 226 [default = 1.0];
  optional double presolve_probing_deterministic_time_limit = 57
      [default = 30.0];

  // Whether we use an heuristic to detect some basic case of blocked clause
  // in the SAT presolve.
  optional bool presolve_blocked_clause = 88 [default = true];

  // Whether or not we use Bounded Variable Addition (BVA) in the presolve.
  optional bool presolve_use_bva = 72 [default = true];

  // Apply Bounded Variable Addition (BVA) if the number of clauses is reduced
  // by stricly more than this threshold. The algorithm described in the paper
  // uses 0, but quick experiments showed that 1 is a good value. It may not be
  // worth it to add a new variable just to remove one clause.
  optional int32 presolve_bva_threshold = 73 [default = 1];

  // In case of large reduction in a presolve iteration, we perform multiple
  // presolve iterations. This parameter controls the maximum number of such
  // presolve iterations.
  optional int32 max_presolve_iterations = 138 [default = 3];

  // Whether we presolve the cp_model before solving it.
  optional bool cp_model_presolve = 86 [default = true];

  // How much effort do we spend on probing. 0 disables it completely.
  optional int32 cp_model_probing_level = 110 [default = 2];

  // Whether we also use the sat presolve when cp_model_presolve is true.
  optional bool cp_model_use_sat_presolve = 93 [default = true];

  // If we try to load at most ones and exactly ones constraints when running
  // the pure SAT presolve. Or if we just ignore them.
  //
  // If one detects at_most_one via merge_at_most_one_work_limit or exactly one
  // with find_clauses_that_are_exactly_one, it might be good to also set this
  // to true.
  optional bool load_at_most_ones_in_sat_presolve = 335 [default = false];

  // If cp_model_presolve is true and there is a large proportion of fixed
  // variable after the first model copy, remap all the model to a dense set of
  // variable before the full presolve even starts. This should help for LNS on
  // large models.
  optional bool remove_fixed_variables_early = 310 [default = true];

  // If true, we detect variable that are unique to a table constraint and only
  // there to encode a cost on each tuple. This is usually the case when a WCSP
  // (weighted constraint program) is encoded into CP-SAT format.
  //
  // This can lead to a dramatic speed-up for such problems but is still
  // experimental at this point.
  optional bool detect_table_with_cost = 216 [default = false];

  // How much we try to "compress" a table constraint. Compressing more leads to
  // less Booleans and faster propagation but can reduced the quality of the lp
  // relaxation. Values goes from 0 to 3 where we always try to fully compress a
  // table. At 2, we try to automatically decide if it is worth it.
  optional int32 table_compression_level = 217 [default = 2];

  // If true, expand all_different constraints that are not permutations.
  // Permutations (#Variables = #Values) are always expanded.
  optional bool expand_alldiff_constraints = 170 [default = false];

  // Max domain size for all_different constraints to be expanded.
  optional int32 max_alldiff_domain_size = 320 [default = 256];

  // If true, expand the reservoir constraints by creating booleans for all
  // possible precedences between event and encoding the constraint.
  optional bool expand_reservoir_constraints = 182 [default = true];

  // Max domain size for expanding linear2 constraints (ax + by ==/!= c).
  optional int32 max_domain_size_for_linear2_expansion = 340 [default = 8];

  // Mainly useful for testing.
  //
  // If this and expand_reservoir_constraints is true, we use a different
  // encoding of the reservoir constraint using circuit instead of precedences.
  // Note that this is usually slower, but can exercise different part of the
  // solver. Note that contrary to the precedence encoding, this easily support
  // variable demands.
  //
  // WARNING: with this encoding, the constraint takes a slightly different
  // meaning. There must exist a permutation of the events occurring at the same
  // time such that the level is within the reservoir after each of these events
  // (in this permuted order). So we cannot have +100 and -100 at the same time
  // if the level must be between 0 and 10 (as authorized by the reservoir
  // constraint).
  optional bool expand_reservoir_using_circuit = 288 [default = false];

  // Encore cumulative with fixed demands and capacity as a reservoir
  // constraint. The only reason you might want to do that is to test the
  // reservoir propagation code!
  optional bool encode_cumulative_as_reservoir = 287 [default = false];

  // If the number of expressions in the lin_max is less that the max size
  // parameter, model expansion replaces target = max(xi) by linear constraint
  // with the introduction of new booleans bi such that bi => target == xi.
  //
  // This is mainly for experimenting compared to a custom lin_max propagator.
  optional int32 max_lin_max_size_for_expansion = 280 [default = 0];

  // If true, it disable all constraint expansion.
  // This should only be used to test the presolve of expanded constraints.
  optional bool disable_constraint_expansion = 181 [default = false];

  // Linear constraint with a complex right hand side (more than a single
  // interval) need to be expanded, there is a couple of way to do that.
  optional bool encode_complex_linear_constraint_with_integer = 223
      [default = false];

  // During presolve, we use a maximum clique heuristic to merge together
  // no-overlap constraints or at most one constraints. This code can be slow,
  // so we have a limit in place on the number of explored nodes in the
  // underlying graph. The internal limit is an int64, but we use double here to
  // simplify manual input.
  optional double merge_no_overlap_work_limit = 145 [default = 1e12];
  optional double merge_at_most_one_work_limit = 146 [default = 1e8];

  // How much substitution (also called free variable aggregation in MIP
  // litterature) should we perform at presolve. This currently only concerns
  // variable appearing only in linear constraints. For now the value 0 turns it
  // off and any positive value performs substitution.
  optional int32 presolve_substitution_level = 147 [default = 1];

  // If true, we will extract from linear constraints, enforcement literals of
  // the form "integer variable at bound => simplified constraint". This should
  // always be beneficial except that we don't always handle them as efficiently
  // as we could for now. This causes problem on manna81.mps (LP relaxation not
  // as tight it seems) and on neos-3354841-apure.mps.gz (too many literals
  // created this way).
  optional bool presolve_extract_integer_enforcement = 174 [default = false];

  // A few presolve operations involve detecting constraints included in other
  // constraint. Since there can be a quadratic number of such pairs, and
  // processing them usually involve scanning them, the complexity of these
  // operations can be big. This enforce a local deterministic limit on the
  // number of entries scanned. Default is 1e8.
  //
  // A value of zero will disable these presolve rules completely.
  optional int64 presolve_inclusion_work_limit = 201 [default = 100000000];

  // If true, we don't keep names in our internal copy of the user given model.
  optional bool ignore_names = 202 [default = true];

  // Run a max-clique code amongst all the x != y we can find and try to infer
  // set of variables that are all different. This allows to close neos16.mps
  // for instance. Note that we only run this code if there is no all_diff
  // already in the model so that if a user want to add some all_diff, we assume
  // it is well done and do not try to add more.
  //
  // This will also detect and add no_overlap constraints, if all the relations
  // x != y have "offsets" between them. I.e. x > y + offset.
  optional bool infer_all_diffs = 233 [default = true];

  // Try to find large "rectangle" in the linear constraint matrix with
  // identical lines. If such rectangle is big enough, we can introduce a new
  // integer variable corresponding to the common expression and greatly reduce
  // the number of non-zero.
  optional bool find_big_linear_overlap = 234 [default = true];

  // By propagating (or just using binary clauses), one can detect that all
  // literal of a clause are actually in at most one relationship. Thus this
  // constraint can be promoted to an exactly one constraints. This should help
  // as it convey more structure. Note that this is expensive, so we have a
  // deterministic limit in place.
  optional bool find_clauses_that_are_exactly_one = 333 [default = true];

  // ==========================================================================
  // Inprocessing
  // ==========================================================================

  // Enable or disable "inprocessing" which is some SAT presolving done at
  // each restart to the root level.
  optional bool use_sat_inprocessing = 163 [default = true];

  // Proportion of deterministic time we should spend on inprocessing.
  // At each "restart", if the proportion is below this ratio, we will do some
  // inprocessing, otherwise, we skip it for this restart.
  optional double inprocessing_dtime_ratio = 273 [default = 0.2];

  // The amount of dtime we should spend on probing for each inprocessing round.
  optional double inprocessing_probing_dtime = 274 [default = 1.0];

  // Parameters for an heuristic similar to the one described in "An effective
  // learnt clause minimization approach for CDCL Sat Solvers",
  // https://www.ijcai.org/proceedings/2017/0098.pdf
  //
  // This is the amount of dtime we should spend on this technique during each
  // inprocessing phase.
  //
  // The minimization technique is the same as the one used to minimize core in
  // max-sat. We also minimize problem clauses and not just the learned clause
  // that we keep forever like in the paper.
  optional double inprocessing_minimization_dtime = 275 [default = 1.0];
  optional bool inprocessing_minimization_use_conflict_analysis = 297
      [default = true];
  optional bool inprocessing_minimization_use_all_orderings = 298
      [default = false];

  // Whether we use the algorithm described in "Clausal Congruence closure",
  // Armin Biere, Katalin Fazekas, Mathias Fleury, Nils Froleyks, 2024.
  //
  // Note that we only have a basic version currently.
  optional bool inprocessing_use_congruence_closure = 342 [default = true];

  // Whether we use the SAT sweeping algorithm described in "Clausal Equivalence
  // Sweeping", Armin Biere, Katalin Fazekas, Mathias Fleury, Nils Froleyks,
  // 2025.
  optional bool inprocessing_use_sat_sweeping = 354 [default = false];

  // ==========================================================================
  // Multithread
  // ==========================================================================

  // Specify the number of parallel workers (i.e. threads) to use during search.
  // This should usually be lower than your number of available cpus +
  // hyperthread in your machine.
  //
  // A value of 0 means the solver will try to use all cores on the machine.
  // A number of 1 means no parallelism.
  //
  // Note that 'num_workers' is the preferred name, but if it is set to zero,
  // we will still read the deprecated 'num_search_workers'.
  //
  // As of 2020-04-10, if you're using SAT via MPSolver (to solve integer
  // programs) this field is overridden with a value of 8, if the field is not
  // set *explicitly*. Thus, always set this field explicitly or via
  // MPSolver::SetNumThreads().
  optional int32 num_workers = 206 [default = 0];
  optional int32 num_search_workers = 100 [default = 0];

  // We distinguish subsolvers that consume a full thread, and the ones that are
  // always interleaved. If left at zero, we will fix this with a default
  // formula that depends on num_workers. But if you start modifying what runs,
  // you might want to fix that to a given value depending on the num_workers
  // you use.
  optional int32 num_full_subsolvers = 294 [default = 0];

  // In multi-thread, the solver can be mainly seen as a portfolio of solvers
  // with different parameters. This field indicates the names of the parameters
  // that are used in multithread. This only applies to "full" subsolvers.
  //
  // See cp_model_search.cc to see a list of the names and the default value (if
  // left empty) that looks like:
  // - default_lp           (linearization_level:1)
  // - fixed                (only if fixed search specified or scheduling)
  // - no_lp                (linearization_level:0)
  // - max_lp               (linearization_level:2)
  // - pseudo_costs         (only if objective, change search heuristic)
  // - reduced_costs        (only if objective, change search heuristic)
  // - quick_restart        (kind of probing)
  // - quick_restart_no_lp  (kind of probing with linearization_level:0)
  // - lb_tree_search       (to improve lower bound, MIP like tree search)
  // - probing              (continuous probing and shaving)
  //
  // Also, note that some set of parameters will be ignored if they do not make
  // sense. For instance if there is no objective, pseudo_cost or reduced_cost
  // search will be ignored. Core based search will only work if the objective
  // has many terms. If there is no fixed strategy fixed will be ignored. And so
  // on.
  //
  // The order is important, as only the first num_full_subsolvers will be
  // scheduled. You can see in the log which one are selected for a given run.
  repeated string subsolvers = 207;

  // A convenient way to add more workers types.
  // These will be added at the beginning of the list.
  repeated string extra_subsolvers = 219;

  // Rather than fully specifying subsolvers, it is often convenient to just
  // remove the ones that are not useful on a given problem or only keep
  // specific ones for testing. Each string is interpreted as a "glob", so we
  // support '*' and '?'.
  //
  // The way this work is that we will only accept a name that match a filter
  // pattern (if non-empty) and do not match an ignore pattern. Note also that
  // these fields work on LNS or LS names even if these are currently not
  // specified via the subsolvers field.
  repeated string ignore_subsolvers = 209;
  repeated string filter_subsolvers = 293;

  // It is possible to specify additional subsolver configuration. These can be
  // referred by their params.name() in the fields above. Note that only the
  // specified field will "overwrite" the ones of the base parameter. If a
  // subsolver_params has the name of an existing subsolver configuration, the
  // named parameters will be merged into the subsolver configuration.
  repeated SatParameters subsolver_params = 210;

  // Experimental. If this is true, then we interleave all our major search
  // strategy and distribute the work amongst num_workers.
  //
  // The search is deterministic (independently of num_workers!), and we
  // schedule and wait for interleave_batch_size task to be completed before
  // synchronizing and scheduling the next batch of tasks.
  optional bool interleave_search = 136 [default = false];
  optional int32 interleave_batch_size = 134 [default = 0];

  // Allows objective sharing between workers.
  optional bool share_objective_bounds = 113 [default = true];

  // Allows sharing of the bounds of modified variables at level 0.
  optional bool share_level_zero_bounds = 114 [default = true];

  // Allows sharing of the bounds on linear2 discovered at level 0. This is
  // mainly interesting on scheduling type of problems when we branch on
  // precedences.
  //
  // Warning: This currently non-deterministic.
  optional bool share_linear2_bounds = 326 [default = false];

  // Allows sharing of new learned binary clause between workers.
  optional bool share_binary_clauses = 203 [default = true];

  // Allows sharing of short glue clauses between workers.
  // Implicitly disabled if share_binary_clauses is false.
  optional bool share_glue_clauses = 285 [default = true];

  // Minimize and detect subsumption of shared clauses immediately after they
  // are imported.
  optional bool minimize_shared_clauses = 300 [default = true];

  // The amount of dtime between each export of shared glue clauses.
  optional double share_glue_clauses_dtime = 322 [default = 1.0];

  // ==========================================================================
  // Proofs
  // ==========================================================================

  // If true, inferred clauses are checked with an LRAT checker as they are
  // learned, in presolve (reduced to trivial simplifications if
  // cp_model_presolve is false), and in each worker. As of December 2025, this
  // only works with pure SAT problems, with
  //  - cp_model_presolve = false,
  //  - linearization_level <= 1,
  //  - symmetry_level <= 1.
  optional bool check_lrat_proof = 344 [default = false];

  // If true, and if output_lrat_proof is true and the problem is UNSAT, check
  // that the merged proof file is valid, i.e., that clause sharing between
  // workers is correct. This checks each inferred clause, so you might want to
  // disable check_lrat_proof to avoid redundant work. As of November 2025, this
  // only works for pure SAT problems, with num_workers = 1.
  optional bool check_merged_lrat_proof = 352 [default = false];

  // If true, an LRAT proof that all the clauses inferred by the solver are
  // valid is output to several files (one for presolve -- reduced to trivial
  // simplifications if cp_model_presolve is false, one per worker, and one for
  // the merged proof). As of December 2025, this only works for pure SAT
  // problems, with
  //  - cp_model_presolve = false,
  //  - linearization_level <= 1,
  //  - symmetry_level <= 1.
  optional bool output_lrat_proof = 345 [default = false];

  // If true, and if the problem is UNSAT, a DRAT proof of this UNSAT property
  // is checked after the solver has finished. As of November 2025, this only
  // works for pure SAT problems, with
  //  - num_workers = 1,
  //  - cp_model_presolve = false,
  //  - linearization_level <= 1,
  //  - symmetry_level <= 1.
  optional bool check_drat_proof = 346 [default = false];

  // If true, a DRAT proof that all the clauses inferred by the solver are valid
  // is output to a file. As of December 2025, this only works for pure SAT
  // problems, with
  //  - num_workers = 1,
  //  - cp_model_presolve = false,
  //  - linearization_level <= 1,
  //  - symmetry_level <= 1.
  optional bool output_drat_proof = 347 [default = false];

  // The maximum time allowed to check the DRAT proof (this can take more time
  // than the solve itself). Only used if check_drat_proof is true.
  optional double max_drat_time_in_seconds = 348 [default = inf];

  // ==========================================================================
  // Debugging parameters
  // ==========================================================================

  // We have two different postsolve code. The default one should be better and
  // it allows for a more powerful presolve, but it can be useful to postsolve
  // using the full solver instead.
  optional bool debug_postsolve_with_full_solver = 162 [default = false];

  // If positive, try to stop just after that many presolve rules have been
  // applied. This is mainly useful for debugging presolve.
  optional int32 debug_max_num_presolve_operations = 151 [default = 0];

  // Crash if we do not manage to complete the hint into a full solution.
  optional bool debug_crash_on_bad_hint = 195 [default = false];

  // Crash if presolve breaks a feasible hint.
  optional bool debug_crash_if_presolve_breaks_hint = 306 [default = false];

  // Crash if the LRAT UNSAT proof is invalid.
  optional bool debug_crash_if_lrat_check_fails = 339 [default = false];

  // ==========================================================================
  // Max-sat parameters
  // ==========================================================================

  // For an optimization problem, whether we follow some hints in order to find
  // a better first solution. For a variable with hint, the solver will always
  // try to follow the hint. It will revert to the variable_branching default
  // otherwise.
  optional bool use_optimization_hints = 35 [default = true];

  // If positive, we spend some effort on each core:
  // - At level 1, we use a simple heuristic to try to minimize an UNSAT core.
  // - At level 2, we use propagation to minimize the core but also identify
  //   literal in at most one relationship in this core.
  optional int32 core_minimization_level = 50 [default = 2];

  // Whether we try to find more independent cores for a given set of
  // assumptions in the core based max-SAT algorithms.
  optional bool find_multiple_cores = 84 [default = true];

  // If true, when the max-sat algo find a core, we compute the minimal number
  // of literals in the core that needs to be true to have a feasible solution.
  // This is also called core exhaustion in more recent max-SAT papers.
  optional bool cover_optimization = 89 [default = true];

  // In what order do we add the assumptions in a core-based max-sat algorithm
  enum MaxSatAssumptionOrder {
    DEFAULT_ASSUMPTION_ORDER = 0;
    ORDER_ASSUMPTION_BY_DEPTH = 1;
    ORDER_ASSUMPTION_BY_WEIGHT = 2;
  }
  optional MaxSatAssumptionOrder max_sat_assumption_order = 51
      [default = DEFAULT_ASSUMPTION_ORDER];

  // If true, adds the assumption in the reverse order of the one defined by
  // max_sat_assumption_order.
  optional bool max_sat_reverse_assumption_order = 52 [default = false];

  // What stratification algorithm we use in the presence of weight.
  enum MaxSatStratificationAlgorithm {
    // No stratification of the problem.
    STRATIFICATION_NONE = 0;

    // Start with literals with the highest weight, and when SAT, add the
    // literals with the next highest weight and so on.
    STRATIFICATION_DESCENT = 1;

    // Start with all literals. Each time a core is found with a given minimum
    // weight, do not consider literals with a lower weight for the next core
    // computation. If the subproblem is SAT, do like in STRATIFICATION_DESCENT
    // and just add the literals with the next highest weight.
    STRATIFICATION_ASCENT = 2;
  }
  optional MaxSatStratificationAlgorithm max_sat_stratification = 53
      [default = STRATIFICATION_DESCENT];

  // ==========================================================================
  // Constraint programming parameters
  // ==========================================================================

  // Some search decisions might cause a really large number of propagations to
  // happen when integer variables with large domains are only reduced by 1 at
  // each step. If we propagate more than the number of variable times this
  // parameters we try to take counter-measure. Setting this to 0.0 disable this
  // feature.
  //
  // TODO(user): Setting this to something like 10 helps in most cases, but the
  // code is currently buggy and can cause the solve to enter a bad state where
  // no progress is made.
  optional double propagation_loop_detection_factor = 221 [default = 10.0];

  // When this is true, then a disjunctive constraint will try to use the
  // precedence relations between time intervals to propagate their bounds
  // further. For instance if task A and B are both before C and task A and B
  // are in disjunction, then we can deduce that task C must start after
  // duration(A) + duration(B) instead of simply max(duration(A), duration(B)),
  // provided that the start time for all task was currently zero.
  //
  // This always result in better propagation, but it is usually slow, so
  // depending on the problem, turning this off may lead to a faster solution.
  optional bool use_precedences_in_disjunctive_constraint = 74 [default = true];

  // At root level, we might compute the transitive closure of "precedences"
  // relations so that we can exploit that in scheduling problems. Setting this
  // to zero disable the feature.
  optional int32 transitive_precedences_work_limit = 327 [default = 1000000];

  // Create one literal for each disjunction of two pairs of tasks. This slows
  // down the solve time, but improves the lower bound of the objective in the
  // makespan case. This will be triggered if the number of intervals is less or
  // equal than the parameter and if use_strong_propagation_in_disjunctive is
  // true.
  optional int32 max_size_to_create_precedence_literals_in_disjunctive = 229
      [default = 60];

  // Enable stronger and more expensive propagation on no_overlap constraint.
  optional bool use_strong_propagation_in_disjunctive = 230 [default = false];

  // Whether we try to branch on decision "interval A before interval B" rather
  // than on intervals bounds. This usually works better, but slow down a bit
  // the time to find the first solution.
  //
  // These parameters are still EXPERIMENTAL, the result should be correct, but
  // it some corner cases, they can cause some failing CHECK in the solver.
  optional bool use_dynamic_precedence_in_disjunctive = 263 [default = false];
  optional bool use_dynamic_precedence_in_cumulative = 268 [default = false];

  // When this is true, the cumulative constraint is reinforced with overload
  // checking, i.e., an additional level of reasoning based on energy. This
  // additional level supplements the default level of reasoning as well as
  // timetable edge finding.
  //
  // This always result in better propagation, but it is usually slow, so
  // depending on the problem, turning this off may lead to a faster solution.
  optional bool use_overload_checker_in_cumulative = 78 [default = false];

  // Enable a heuristic to solve cumulative constraints using a modified energy
  // constraint. We modify the usual energy definition by applying a
  // super-additive function (also called "conservative scale" or "dual-feasible
  // function") to the demand and the durations of the tasks.
  //
  // This heuristic is fast but for most problems it does not help much to find
  // a solution.
  optional bool use_conservative_scale_overload_checker = 286 [default = false];

  // When this is true, the cumulative constraint is reinforced with timetable
  // edge finding, i.e., an additional level of reasoning based on the
  // conjunction of energy and mandatory parts. This additional level
  // supplements the default level of reasoning as well as overload_checker.
  //
  // This always result in better propagation, but it is usually slow, so
  // depending on the problem, turning this off may lead to a faster solution.
  optional bool use_timetable_edge_finding_in_cumulative = 79 [default = false];

  // Max number of intervals for the timetable_edge_finding algorithm to
  // propagate. A value of 0 disables the constraint.
  optional int32 max_num_intervals_for_timetable_edge_finding = 260
      [default = 100];

  // If true, detect and create constraint for integer variable that are "after"
  // a set of intervals in the same cumulative constraint.
  //
  // Experimental: by default we just use "direct" precedences. If
  // exploit_all_precedences is true, we explore the full precedence graph. This
  // assumes we have a DAG otherwise it fails.
  optional bool use_hard_precedences_in_cumulative = 215 [default = false];
  optional bool exploit_all_precedences = 220 [default = false];

  // When this is true, the cumulative constraint is reinforced with propagators
  // from the disjunctive constraint to improve the inference on a set of tasks
  // that are disjunctive at the root of the problem. This additional level
  // supplements the default level of reasoning.
  //
  // Propagators of the cumulative constraint will not be used at all if all the
  // tasks are disjunctive at root node.
  //
  // This always result in better propagation, but it is usually slow, so
  // depending on the problem, turning this off may lead to a faster solution.
  optional bool use_disjunctive_constraint_in_cumulative = 80 [default = true];

  // If less than this number of boxes are present in a no-overlap 2d, we
  // create 4 Booleans per pair of boxes:
  // - Box 2 is after Box 1 on x.
  // - Box 1 is after Box 2 on x.
  // - Box 2 is after Box 1 on y.
  // - Box 1 is after Box 2 on y.
  //
  // Note that at least one of them must be true, and at most one on x and one
  // on y can be true.
  //
  // This can significantly help in closing small problem. The SAT reasoning
  // can be a lot more powerful when we take decision on such positional
  // relations.
  optional int32 no_overlap_2d_boolean_relations_limit = 321 [default = 10];

  // When this is true, the no_overlap_2d constraint is reinforced with
  // propagators from the cumulative constraints. It consists of ignoring the
  // position of rectangles in one position and projecting the no_overlap_2d on
  // the other dimension to create a cumulative constraint. This is done on both
  // axis. This additional level supplements the default level of reasoning.
  optional bool use_timetabling_in_no_overlap_2d = 200 [default = false];

  // When this is true, the no_overlap_2d constraint is reinforced with
  // energetic reasoning. This additional level supplements the default level of
  // reasoning.
  optional bool use_energetic_reasoning_in_no_overlap_2d = 213
      [default = false];

  // When this is true, the no_overlap_2d constraint is reinforced with
  // an energetic reasoning that uses an area-based energy. This can be combined
  // with the two other overlap heuristics above.
  optional bool use_area_energetic_reasoning_in_no_overlap_2d = 271
      [default = false];

  optional bool use_try_edge_reasoning_in_no_overlap_2d = 299 [default = false];

  // If the number of pairs to look is below this threshold, do an extra step of
  // propagation in the no_overlap_2d constraint by looking at all pairs of
  // intervals.
  optional int32 max_pairs_pairwise_reasoning_in_no_overlap_2d = 276
      [default = 1250];

  // Detects when the space where items of a no_overlap_2d constraint can placed
  // is disjoint (ie., fixed boxes split the domain). When it is the case, we
  // can introduce a boolean for each pair <item, component> encoding whether
  // the item is in the component or not. Then we replace the original
  // no_overlap_2d constraint by one no_overlap_2d constraint for each
  // component, with the new booleans as the enforcement_literal of the
  // intervals. This is equivalent to expanding the original no_overlap_2d
  // constraint into a bin packing problem with each connected component being a
  // bin. This heuristic is only done when the number of regions to split
  // is less than this parameter and <= 1 disables it.
  optional int32 maximum_regions_to_split_in_disconnected_no_overlap_2d = 315
      [default = 0];

  // When set, this activates a propagator for the no_overlap_2d constraint that
  // uses any eventual linear constraints of the model in the form
  // \`{start interval 1} - {end interval 2} + c*w <= ub\` to detect that two
  // intervals must overlap in one dimension for some values of \`w\`. This is
  // particularly useful for problems where the distance between two boxes is
  // part of the model.
  optional bool use_linear3_for_no_overlap_2d_precedences = 323
      [default = true];

  // When set, it activates a few scheduling parameters to improve the lower
  // bound of scheduling problems. This is only effective with multiple workers
  // as it modifies the reduced_cost, lb_tree_search, and probing workers.
  optional bool use_dual_scheduling_heuristics = 214 [default = true];

  // Turn on extra propagation for the circuit constraint.
  // This can be quite slow.
  optional bool use_all_different_for_circuit = 311 [default = false];

  // If the size of a subset of nodes of a RoutesConstraint is less than this
  // value, use linear constraints of size 1 and 2 (such as capacity and time
  // window constraints) enforced by the arc literals to compute cuts for this
  // subset (unless the subset size is less than
  // routing_cut_subset_size_for_tight_binary_relation_bound, in which case the
  // corresponding algorithm is used instead). The algorithm for these cuts has
  // a O(n^3) complexity, where n is the subset size. Hence the value of this
  // parameter should not be too large (e.g. 10 or 20).
  optional int32 routing_cut_subset_size_for_binary_relation_bound = 312
      [default = 0];

  // Similar to above, but with a different algorithm producing better cuts, at
  // the price of a higher O(2^n) complexity, where n is the subset size. Hence
  // the value of this parameter should be small (e.g. less than 10).
  optional int32 routing_cut_subset_size_for_tight_binary_relation_bound = 313
      [default = 0];

  // Similar to above, but with an even stronger algorithm in O(n!). We try to
  // be defensive and abort early or not run that often. Still the value of
  // that parameter shouldn't really be much more than 10.
  optional int32 routing_cut_subset_size_for_exact_binary_relation_bound = 316
      [default = 8];

  // Similar to routing_cut_subset_size_for_exact_binary_relation_bound but
  // use a bound based on shortest path distances (which respect triangular
  // inequality). This allows to derive bounds that are valid for any superset
  // of a given subset. This is slow, so it shouldn't really be larger than 10.
  optional int32 routing_cut_subset_size_for_shortest_paths_bound = 318
      [default = 8];

  // The amount of "effort" to spend in dynamic programming for computing
  // routing cuts. This is in term of basic operations needed by the algorithm
  // in the worst case, so a value like 1e8 should take less than a second to
  // compute.
  optional double routing_cut_dp_effort = 314 [default = 1e7];

  // If the length of an infeasible path is less than this value, a cut will be
  // added to exclude it.
  optional int32 routing_cut_max_infeasible_path_length = 317 [default = 6];

  // The search branching will be used to decide how to branch on unfixed nodes.
  enum SearchBranching {
    // Try to fix all literals using the underlying SAT solver's heuristics,
    // then generate and fix literals until integer variables are fixed. New
    // literals on integer variables are generated using the fixed search
    // specified by the user or our default one.
    AUTOMATIC_SEARCH = 0;

    // If used then all decisions taken by the solver are made using a fixed
    // order as specified in the API or in the CpModelProto search_strategy
    // field.
    FIXED_SEARCH = 1;

    // Simple portfolio search used by LNS workers.
    PORTFOLIO_SEARCH = 2;

    // If used, the solver will use heuristics from the LP relaxation. This
    // exploit the reduced costs of the variables in the relaxation.
    LP_SEARCH = 3;

    // If used, the solver uses the pseudo costs for branching. Pseudo costs
    // are computed using the historical change in objective bounds when some
    // decision are taken. Note that this works whether we use an LP or not.
    PSEUDO_COST_SEARCH = 4;

    // Mainly exposed here for testing. This quickly tries a lot of randomized
    // heuristics with a low conflict limit. It usually provides a good first
    // solution.
    PORTFOLIO_WITH_QUICK_RESTART_SEARCH = 5;

    // Mainly used internally. This is like FIXED_SEARCH, except we follow the
    // solution_hint field of the CpModelProto rather than using the information
    // provided in the search_strategy.
    HINT_SEARCH = 6;

    // Similar to FIXED_SEARCH, but differ in how the variable not listed into
    // the fixed search heuristics are branched on. This will always start the
    // search tree according to the specified fixed search strategy, but will
    // complete it using the default automatic search.
    PARTIAL_FIXED_SEARCH = 7;

    // Randomized search. Used to increase entropy in the search.
    RANDOMIZED_SEARCH = 8;
  }
  optional SearchBranching search_branching = 82 [default = AUTOMATIC_SEARCH];

  // Conflict limit used in the phase that exploit the solution hint.
  optional int32 hint_conflict_limit = 153 [default = 10];

  // If true, the solver tries to repair the solution given in the hint. This
  // search terminates after the 'hint_conflict_limit' is reached and the solver
  // switches to regular search. If false, then  we do a FIXED_SEARCH using the
  // hint until the hint_conflict_limit is reached.
  optional bool repair_hint = 167 [default = false];

  // If true, variables appearing in the solution hints will be fixed to their
  // hinted value.
  optional bool fix_variables_to_their_hinted_value = 192 [default = false];

  // If true, search will continuously probe Boolean variables, and integer
  // variable bounds. This parameter is set to true in parallel on the probing
  // worker.
  optional bool use_probing_search = 176 [default = false];

  // Use extended probing (probe bool_or, at_most_one, exactly_one).
  optional bool use_extended_probing = 269 [default = true];

  // How many combinations of pairs or triplets of variables we want to scan.
  optional int32 probing_num_combinations_limit = 272 [default = 20000];

  // Add a shaving phase (where the solver tries to prove that the lower or
  // upper bound of a variable are infeasible) to the probing search. (<= 0
  // disables it).
  optional double shaving_deterministic_time_in_probing_search = 204
      [default = 0.001];

  // Specifies the amount of deterministic time spent of each try at shaving a
  // bound in the shaving search.
  optional double shaving_search_deterministic_time = 205 [default = 0.1];

  // Specifies the threshold between two modes in the shaving procedure.
  // If the range of the variable/objective is less than this threshold, then
  // the shaving procedure will try to remove values one by one. Otherwise, it
  // will try to remove one range at a time.
  optional int64 shaving_search_threshold = 290 [default = 64];

  // If true, search will search in ascending max objective value (when
  // minimizing) starting from the lower bound of the objective.
  optional bool use_objective_lb_search = 228 [default = false];

  // This search differs from the previous search as it will not use assumptions
  // to bound the objective, and it will recreate a full model with the
  // hardcoded objective value.
  optional bool use_objective_shaving_search = 253 [default = false];

  // This search takes all Boolean or integer variables, and maximize or
  // minimize them in order to reduce their domain. -1 is automatic, otherwise
  // value 0 disables it, and 1, 2, or 3 changes something.
  optional int32 variables_shaving_level = 289 [default = -1];

  // The solver ignores the pseudo costs of variables with number of recordings
  // less than this threshold.
  optional int64 pseudo_cost_reliability_threshold = 123 [default = 100];

  // The default optimization method is a simple "linear scan", each time trying
  // to find a better solution than the previous one. If this is true, then we
  // use a core-based approach (like in max-SAT) when we try to increase the
  // lower bound instead.
  optional bool optimize_with_core = 83 [default = false];

  // Do a more conventional tree search (by opposition to SAT based one) where
  // we keep all the explored node in a tree. This is meant to be used in a
  // portfolio and focus on improving the objective lower bound. Keeping the
  // whole tree allow us to report a better objective lower bound coming from
  // the worst open node in the tree.
  optional bool optimize_with_lb_tree_search = 188 [default = false];

  // Experimental. Save the current LP basis at each node of the search tree so
  // that when we jump around, we can load it and reduce the number of LP
  // iterations needed.
  //
  // It currently works okay if we do not change the lp with cuts or
  // simplification... More work is needed to make it robust in all cases.
  optional bool save_lp_basis_in_lb_tree_search = 284 [default = false];

  // If non-negative, perform a binary search on the objective variable in order
  // to find an [min, max] interval outside of which the solver proved unsat/sat
  // under this amount of conflict. This can quickly reduce the objective domain
  // on some problems.
  optional int32 binary_search_num_conflicts = 99 [default = -1];

  // This has no effect if optimize_with_core is false. If true, use a different
  // core-based algorithm similar to the max-HS algo for max-SAT. This is a
  // hybrid MIP/CP approach and it uses a MIP solver in addition to the CP/SAT
  // one. This is also related to the PhD work of tobyodavies@
  // "Automatic Logic-Based Benders Decomposition with MiniZinc"
  // http://aaai.org/ocs/index.php/AAAI/AAAI17/paper/view/14489
  optional bool optimize_with_max_hs = 85 [default = false];

  // Parameters for an heuristic similar to the one described in the paper:
  // "Feasibility Jump: an LP-free Lagrangian MIP heuristic", Bj\xF8rnar
  // Luteberget, Giorgio Sartor, 2023, Mathematical Programming Computation.
  optional bool use_feasibility_jump = 265 [default = true];

  // Disable every other type of subsolver, setting this turns CP-SAT into a
  // pure local-search solver.
  optional bool use_ls_only = 240 [default = false];

  // On each restart, we randomly choose if we use decay (with this parameter)
  // or no decay.
  optional double feasibility_jump_decay = 242 [default = 0.95];

  // How much do we linearize the problem in the local search code.
  optional int32 feasibility_jump_linearization_level = 257 [default = 2];

  // This is a factor that directly influence the work before each restart.
  // Increasing it leads to longer restart.
  optional int32 feasibility_jump_restart_factor = 258 [default = 1];

  // How much dtime for each LS batch.
  optional double feasibility_jump_batch_dtime = 292 [default = 0.1];

  // Probability for a variable to have a non default value upon restarts or
  // perturbations.
  optional double feasibility_jump_var_randomization_probability = 247
      [default = 0.05];

  // Max distance between the default value and the pertubated value relative to
  // the range of the domain of the variable.
  optional double feasibility_jump_var_perburbation_range_ratio = 248
      [default = 0.2];

  // When stagnating, feasibility jump will either restart from a default
  // solution (with some possible randomization), or randomly pertubate the
  // current solution. This parameter selects the first option.
  optional bool feasibility_jump_enable_restarts = 250 [default = true];

  // Maximum size of no_overlap or no_overlap_2d constraint for a quadratic
  // expansion. This might look a lot, but by expanding such constraint, we get
  // a linear time evaluation per single variable moves instead of a slow O(n
  // log n) one.
  optional int32 feasibility_jump_max_expanded_constraint_size = 264
      [default = 500];

  // This will create incomplete subsolvers (that are not LNS subsolvers)
  // that use the feasibility jump code to find improving solution, treating
  // the objective improvement as a hard constraint.
  optional int32 num_violation_ls = 244 [default = 0];

  // How long violation_ls should wait before perturbating a solution.
  optional int32 violation_ls_perturbation_period = 249 [default = 100];

  // Probability of using compound move search each restart.
  // TODO(user): Add reference to paper when published.
  optional double violation_ls_compound_move_probability = 259 [default = 0.5];

  // Enables shared tree search.
  // If positive, start this many complete worker threads to explore a shared
  // search tree. These workers communicate objective bounds and simple decision
  // nogoods relating to the shared prefix of the tree, and will avoid exploring
  // the same subtrees as one another.
  // Specifying a negative number uses a heuristic to select an appropriate
  // number of shared tree workeres based on the total number of workers.
  optional int32 shared_tree_num_workers = 235 [default = -1];

  // Set on shared subtree workers. Users should not set this directly.
  optional bool use_shared_tree_search = 236 [default = false];

  // Minimum restarts before a worker will replace a subtree
  // that looks "bad" based on the average LBD of learned clauses.
  optional int32 shared_tree_worker_min_restarts_per_subtree = 282
      [default = 1];

  // If true, workers share more of the information from their local trail.
  // Specifically, literals implied by the shared tree decisions.
  optional bool shared_tree_worker_enable_trail_sharing = 295 [default = true];

  // If true, shared tree workers share their target phase when returning an
  // assigned subtree for the next worker to use.
  optional bool shared_tree_worker_enable_phase_sharing = 304 [default = true];

  // How many open leaf nodes should the shared tree maintain per worker.
  optional double shared_tree_open_leaves_per_worker = 281 [default = 2.0];

  // In order to limit total shared memory and communication overhead, limit the
  // total number of nodes that may be generated in the shared tree. If the
  // shared tree runs out of unassigned leaves, workers act as portfolio
  // workers. Note: this limit includes interior nodes, not just leaves.
  optional int32 shared_tree_max_nodes_per_worker = 238 [default = 10000];

  enum SharedTreeSplitStrategy {
    // Uses the default strategy, currently equivalent to
    // SPLIT_STRATEGY_DISCREPANCY.
    SPLIT_STRATEGY_AUTO = 0;
    // Only accept splits if the node to be split's depth+discrepancy is minimal
    // for the desired number of leaves.
    // The preferred child for discrepancy calculation is the one with the
    // lowest objective lower bound or the original branch direction if the
    // bounds are equal. This rule allows twice as many workers to work in the
    // preferred subtree as non-preferred.
    SPLIT_STRATEGY_DISCREPANCY = 1;
    // Only split nodes with an objective lb equal to the global lb. If there is
    // no objective, this is equivalent to SPLIT_STRATEGY_FIRST_PROPOSAL.
    SPLIT_STRATEGY_OBJECTIVE_LB = 2;
    // Attempt to keep the shared tree balanced.
    SPLIT_STRATEGY_BALANCED_TREE = 3;
    // Workers race to split their subtree, the winner's proposal is accepted.
    SPLIT_STRATEGY_FIRST_PROPOSAL = 4;
  }
  optional SharedTreeSplitStrategy shared_tree_split_strategy = 239
      [default = SPLIT_STRATEGY_AUTO];

  // How much deeper compared to the ideal max depth of the tree is considered
  // "balanced" enough to still accept a split. Without such a tolerance,
  // sometimes the tree can only be split by a single worker, and they may not
  // generate a split for some time. In contrast, with a tolerance of 1, at
  // least half of all workers should be able to split the tree as soon as a
  // split becomes required. This only has an effect on
  // SPLIT_STRATEGY_BALANCED_TREE and SPLIT_STRATEGY_DISCREPANCY.
  optional int32 shared_tree_balance_tolerance = 305 [default = 1];

  // How much dtime a worker will wait between proposing splits.
  // This limits the contention in splitting the shared tree, and also reduces
  // the number of too-easy subtrees that are generates.
  optional double shared_tree_split_min_dtime = 328 [default = 0.1];

  // Whether we enumerate all solutions of a problem without objective.
  //
  // WARNING:
  // - This can be used with num_workers > 1 but then each solutions can be
  //   found more than once, so it is up to the client to deduplicate them.
  // - If keep_all_feasible_solutions_in_presolve is unset, we will set it to
  //   true as otherwise, many feasible solution can just be removed by the
  //   presolve. It is still possible to manually set this to false if one only
  //   wants to enumerate all solutions of the presolved model.
  optional bool enumerate_all_solutions = 87 [default = false];

  // If true, we disable the presolve reductions that remove feasible solutions
  // from the search space. Such solution are usually dominated by a "better"
  // solution that is kept, but depending on the situation, we might want to
  // keep all solutions.
  //
  // A trivial example is when a variable is unused. If this is true, then the
  // presolve will not fix it to an arbitrary value and it will stay in the
  // search space.
  optional bool keep_all_feasible_solutions_in_presolve = 173 [default = false];

  // If true, add information about the derived variable domains to the
  // CpSolverResponse. It is an option because it makes the response slighly
  // bigger and there is a bit more work involved during the postsolve to
  // construct it, but it should still have a low overhead. See the
  // tightened_variables field in CpSolverResponse for more details.
  optional bool fill_tightened_domains_in_response = 132 [default = false];

  // If true, the final response addition_solutions field will be filled with
  // all solutions from our solutions pool.
  //
  // Note that if both this field and enumerate_all_solutions is true, we will
  // copy to the pool all of the solution found. So if solution_pool_size is big
  // enough, you can get all solutions this way instead of using the solution
  // callback.
  //
  // Note that this only affect the "final" solution, not the one passed to the
  // solution callbacks.
  optional bool fill_additional_solutions_in_response = 194 [default = false];

  // If true, the solver will add a default integer branching strategy to the
  // already defined search strategy. If not, some variable might still not be
  // fixed at the end of the search. For now we assume these variable can just
  // be set to their lower bound.
  optional bool instantiate_all_variables = 106 [default = true];

  // If true, then the precedences propagator try to detect for each variable if
  // it has a set of "optional incoming arc" for which at least one of them is
  // present. This is usually useful to have but can be slow on model with a lot
  // of precedence.
  optional bool auto_detect_greater_than_at_least_one_of = 95 [default = true];

  // For an optimization problem, stop the solver as soon as we have a solution.
  optional bool stop_after_first_solution = 98 [default = false];

  // Mainly used when improving the presolver. When true, stops the solver after
  // the presolve is complete (or after loading and root level propagation).
  optional bool stop_after_presolve = 149 [default = false];
  optional bool stop_after_root_propagation = 252 [default = false];

  // LNS parameters.

  // Initial parameters for neighborhood generation.
  optional double lns_initial_difficulty = 307 [default = 0.5];
  optional double lns_initial_deterministic_limit = 308 [default = 0.1];

  // Testing parameters used to disable all lns workers.
  optional bool use_lns = 283 [default = true];

  // Experimental parameters to disable everything but lns.
  optional bool use_lns_only = 101 [default = false];

  // Size of the top-n different solutions kept by the solver.
  // This parameter must be > 0. Currently, having this larger than one mainly
  // impact the "base" solution chosen for a LNS/LS fragment.
  optional int32 solution_pool_size = 193 [default = 3];

  // If solution_pool_size is <= this, we will use DP to keep a "diverse" set
  // of solutions (the one further apart via hamming distance) in the pool.
  // Setting this to large value might be slow, especially if your solution are
  // large.
  optional int32 solution_pool_diversity_limit = 329 [default = 10];

  // In order to not get stuck in local optima, when this is non-zero, we try to
  // also work on "older" solutions with a worse objective value so we get a
  // chance to follow a different LS/LNS trajectory.
  optional int32 alternative_pool_size = 325 [default = 1];

  // Turns on relaxation induced neighborhood generator.
  optional bool use_rins_lns = 129 [default = true];

  // Adds a feasibility pump subsolver along with lns subsolvers.
  optional bool use_feasibility_pump = 164 [default = true];

  // Turns on neighborhood generator based on local branching LP. Based on Huang
  // et al., "Local Branching Relaxation Heuristics for Integer Linear
  // Programs", 2023.
  optional bool use_lb_relax_lns = 255 [default = true];

  // Only use lb-relax if we have at least that many workers.
  optional int32 lb_relax_num_workers_threshold = 296 [default = 16];

  // Rounding method to use for feasibility pump.
  enum FPRoundingMethod {
    // Rounds to the nearest integer value.
    NEAREST_INTEGER = 0;

    // Counts the number of linear constraints restricting the variable in the
    // increasing values (up locks) and decreasing values (down locks). Rounds
    // the variable in the direction of lesser locks.
    LOCK_BASED = 1;

    // Similar to lock based rounding except this only considers locks of active
    // constraints from the last lp solve.
    ACTIVE_LOCK_BASED = 3;

    // This is expensive rounding algorithm. We round variables one by one and
    // propagate the bounds in between. If none of the rounded values fall in
    // the continuous domain specified by lower and upper bound, we use the
    // current lower/upper bound (whichever one is closest) instead of rounding
    // the fractional lp solution value. If both the rounded values are in the
    // domain, we round to nearest integer.
    PROPAGATION_ASSISTED = 2;
  }
  optional FPRoundingMethod fp_rounding = 165 [default = PROPAGATION_ASSISTED];

  // If true, registers more lns subsolvers with different parameters.
  optional bool diversify_lns_params = 137 [default = false];

  // Randomize fixed search.
  optional bool randomize_search = 103 [default = false];

  // Search randomization will collect the top
  // 'search_random_variable_pool_size' valued variables, and pick one randomly.
  // The value of the variable is specific to each strategy.
  optional int64 search_random_variable_pool_size = 104 [default = 0];

  // Experimental code: specify if the objective pushes all tasks toward the
  // start of the schedule.
  optional bool push_all_tasks_toward_start = 262 [default = false];

  // If true, we automatically detect variables whose constraint are always
  // enforced by the same literal and we mark them as optional. This allows
  // to propagate them as if they were present in some situation.
  //
  // TODO(user): This is experimental and seems to lead to wrong optimal in
  // some situation. It should however gives correct solutions. Fix.
  optional bool use_optional_variables = 108 [default = false];

  // The solver usually exploit the LP relaxation of a model. If this option is
  // true, then whatever is infered by the LP will be used like an heuristic to
  // compute EXACT propagation on the IP. So with this option, there is no
  // numerical imprecision issues.
  optional bool use_exact_lp_reason = 109 [default = true];

  // This can be beneficial if there is a lot of no-overlap constraints but a
  // relatively low number of different intervals in the problem. Like 1000
  // intervals, but 1M intervals in the no-overlap constraints covering them.
  optional bool use_combined_no_overlap = 133 [default = false];

  // All at_most_one constraints with a size <= param will be replaced by a
  // quadratic number of binary implications.
  optional int32 at_most_one_max_expansion_size = 270 [default = 3];

  // Indicates if the CP-SAT layer should catch Control-C (SIGINT) signals
  // when calling solve. If set, catching the SIGINT signal will terminate the
  // search gracefully, as if a time limit was reached.
  optional bool catch_sigint_signal = 135 [default = true];

  // Stores and exploits "implied-bounds" in the solver. That is, relations of
  // the form literal => (var >= bound). This is currently used to derive
  // stronger cuts.
  optional bool use_implied_bounds = 144 [default = true];

  // Whether we try to do a few degenerate iteration at the end of an LP solve
  // to minimize the fractionality of the integer variable in the basis. This
  // helps on some problems, but not so much on others. It also cost of bit of
  // time to do such polish step.
  optional bool polish_lp_solution = 175 [default = false];

  // The internal LP tolerances used by CP-SAT. These applies to the internal
  // and scaled problem. If the domains of your variables are large it might be
  // good to use lower tolerances. If your problem is binary with low
  // coefficients, it might be good to use higher ones to speed-up the lp
  // solves.
  optional double lp_primal_tolerance = 266 [default = 1e-7];
  optional double lp_dual_tolerance = 267 [default = 1e-7];

  // Temporary flag util the feature is more mature. This convert intervals to
  // the newer proto format that support affine start/var/end instead of just
  // variables.
  optional bool convert_intervals = 177 [default = true];

  // Whether we try to automatically detect the symmetries in a model and
  // exploit them. Currently, at level 1 we detect them in presolve and try
  // to fix Booleans. At level 2, we also do some form of dynamic symmetry
  // breaking during search. At level 3, we also detect symmetries for very
  // large models, which can be slow. At level 4, we try to break as much
  // symmetry as possible in presolve.
  optional int32 symmetry_level = 183 [default = 2];

  // When we have symmetry, it is possible to "fold" all variables from the same
  // orbit into a single variable, while having the same power of LP relaxation.
  // This can help significantly on symmetric problem. However there is
  // currently a bit of overhead as the rest of the solver need to do some
  // translation between the folded LP and the rest of the problem.
  optional bool use_symmetry_in_lp = 301 [default = false];

  // Experimental. This will compute the symmetry of the problem once and for
  // all. All presolve operations we do should keep the symmetry group intact
  // or modify it properly. For now we have really little support for this. We
  // will disable a bunch of presolve operations that could be supported.
  optional bool keep_symmetry_in_presolve = 303 [default = false];

  // Deterministic time limit for symmetry detection.
  optional double symmetry_detection_deterministic_time_limit = 302
      [default = 1.0];

  // The new linear propagation code treat all constraints at once and use
  // an adaptation of Bellman-Ford-Tarjan to propagate constraint in a smarter
  // order and potentially detect propagation cycle earlier.
  optional bool new_linear_propagation = 224 [default = true];

  // Linear constraints that are not pseudo-Boolean and that are longer than
  // this size will be split into sqrt(size) intermediate sums in order to have
  // faster propation in the CP engine.
  optional int32 linear_split_size = 256 [default = 100];

  // ==========================================================================
  // Linear programming relaxation
  // ==========================================================================

  // A non-negative level indicating the type of constraints we consider in the
  // LP relaxation. At level zero, no LP relaxation is used. At level 1, only
  // the linear constraint and full encoding are added. At level 2, we also add
  // all the Boolean constraints.
  optional int32 linearization_level = 90 [default = 1];

  // A non-negative level indicating how much we should try to fully encode
  // Integer variables as Boolean.
  optional int32 boolean_encoding_level = 107 [default = 1];

  // When loading a*x + b*y ==/!= c when x and y are both fully encoded.
  // The solver may decide to replace the linear equation by a set of clauses.
  // This is triggered if the sizes of the domains of x and y are below the
  // threshold.
  optional int32 max_domain_size_when_encoding_eq_neq_constraints = 191
      [default = 16];

  // The limit on the number of cuts in our cut pool. When this is reached we do
  // not generate cuts anymore.
  //
  // TODO(user): We should probably remove this parameters, and just always
  // generate cuts but only keep the best n or something.
  optional int32 max_num_cuts = 91 [default = 10000];

  // Control the global cut effort. Zero will turn off all cut. For now we just
  // have one level. Note also that most cuts are only used at linearization
  // level >= 2.
  optional int32 cut_level = 196 [default = 1];

  // For the cut that can be generated at any level, this control if we only
  // try to generate them at the root node.
  optional bool only_add_cuts_at_level_zero = 92 [default = false];

  // When the LP objective is fractional, do we add the cut that forces the
  // linear objective expression to be greater or equal to this fractional value
  // rounded up? We can always do that since our objective is integer, and
  // combined with MIR heuristic to reduce the coefficient of such cut, it can
  // help.
  optional bool add_objective_cut = 197 [default = false];

  // Whether we generate and add Chvatal-Gomory cuts to the LP at root node.
  // Note that for now, this is not heavily tuned.
  optional bool add_cg_cuts = 117 [default = true];

  // Whether we generate MIR cuts at root node.
  // Note that for now, this is not heavily tuned.
  optional bool add_mir_cuts = 120 [default = true];

  // Whether we generate Zero-Half cuts at root node.
  // Note that for now, this is not heavily tuned.
  optional bool add_zero_half_cuts = 169 [default = true];

  // Whether we generate clique cuts from the binary implication graph. Note
  // that as the search goes on, this graph will contains new binary clauses
  // learned by the SAT engine.
  optional bool add_clique_cuts = 172 [default = true];

  // Whether we generate RLT cuts. This is still experimental but can help on
  // binary problem with a lot of clauses of size 3.
  optional bool add_rlt_cuts = 279 [default = true];

  // Cut generator for all diffs can add too many cuts for large all_diff
  // constraints. This parameter restricts the large all_diff constraints to
  // have a cut generator.
  optional int32 max_all_diff_cut_size = 148 [default = 64];

  // For the lin max constraints, generates the cuts described in "Strong
  // mixed-integer programming formulations for trained neural networks" by Ross
  // Anderson et. (https://arxiv.org/pdf/1811.01988.pdf)
  optional bool add_lin_max_cuts = 152 [default = true];

  // In the integer rounding procedure used for MIR and Gomory cut, the maximum
  // "scaling" we use (must be positive). The lower this is, the lower the
  // integer coefficients of the cut will be. Note that cut generated by lower
  // values are not necessarily worse than cut generated by larger value. There
  // is no strict dominance relationship.
  //
  // Setting this to 2 result in the "strong fractional rouding" of Letchford
  // and Lodi.
  optional int32 max_integer_rounding_scaling = 119 [default = 600];

  // If true, we start by an empty LP, and only add constraints not satisfied
  // by the current LP solution batch by batch. A constraint that is only added
  // like this is known as a "lazy" constraint in the literature, except that we
  // currently consider all constraints as lazy here.
  optional bool add_lp_constraints_lazily = 112 [default = true];

  // Even at the root node, we do not want to spend too much time on the LP if
  // it is "difficult". So we solve it in "chunks" of that many iterations. The
  // solve will be continued down in the tree or the next time we go back to the
  // root node.
  optional int32 root_lp_iterations = 227 [default = 2000];

  // While adding constraints, skip the constraints which have orthogonality
  // less than 'min_orthogonality_for_lp_constraints' with already added
  // constraints during current call. Orthogonality is defined as 1 -
  // cosine(vector angle between constraints). A value of zero disable this
  // feature.
  optional double min_orthogonality_for_lp_constraints = 115 [default = 0.05];

  // Max number of time we perform cut generation and resolve the LP at level 0.
  optional int32 max_cut_rounds_at_level_zero = 154 [default = 1];

  // If a constraint/cut in LP is not active for that many consecutive OPTIMAL
  // solves, remove it from the LP. Note that it might be added again later if
  // it become violated by the current LP solution.
  optional int32 max_consecutive_inactive_count = 121 [default = 100];

  // These parameters are similar to sat clause management activity parameters.
  // They are effective only if the number of generated cuts exceed the storage
  // limit. Default values are based on a few experiments on miplib instances.
  optional double cut_max_active_count_value = 155 [default = 1e10];
  optional double cut_active_count_decay = 156 [default = 0.8];

  // Target number of constraints to remove during cleanup.
  optional int32 cut_cleanup_target = 157 [default = 1000];

  // Add that many lazy constraints (or cuts) at once in the LP. Note that at
  // the beginning of the solve, we do add more than this.
  optional int32 new_constraints_batch_size = 122 [default = 50];

  // All the "exploit_*" parameters below work in the same way: when branching
  // on an IntegerVariable, these parameters affect the value the variable is
  // branched on. Currently the first heuristic that triggers win in the order
  // in which they appear below.
  //
  // TODO(user): Maybe do like for the restart algorithm, introduce an enum
  // and a repeated field that control the order on which these are applied?

  // If true and the Lp relaxation of the problem has an integer optimal
  // solution, try to exploit it. Note that since the LP relaxation may not
  // contain all the constraints, such a solution is not necessarily a solution
  // of the full problem.
  optional bool exploit_integer_lp_solution = 94 [default = true];

  // If true and the Lp relaxation of the problem has a solution, try to exploit
  // it. This is same as above except in this case the lp solution might not be
  // an integer solution.
  optional bool exploit_all_lp_solution = 116 [default = true];

  // When branching on a variable, follow the last best solution value.
  optional bool exploit_best_solution = 130 [default = false];

  // When branching on a variable, follow the last best relaxation solution
  // value. We use the relaxation with the tightest bound on the objective as
  // the best relaxation solution.
  optional bool exploit_relaxation_solution = 161 [default = false];

  // When branching an a variable that directly affect the objective,
  // branch on the value that lead to the best objective first.
  optional bool exploit_objective = 131 [default = true];

  // Infer products of Boolean or of Boolean time IntegerVariable from the
  // linear constrainst in the problem. This can be used in some cuts, altough
  // for now we don't really exploit it.
  optional bool detect_linearized_product = 277 [default = false];

  // This should be better on integer problems.
  // But it is still work in progress.
  optional bool use_new_integer_conflict_resolution = 336 [default = false];

  // If true, and during integer conflict resolution (icr) the 1-UIP is an
  // integer literal for which we do not have an associated Boolean. Create one.
  optional bool create_1uip_boolean_during_icr = 341 [default = true];

  // ==========================================================================
  // MIP -> CP-SAT (i.e. IP with integer coeff) conversion parameters that are
  // used by our automatic "scaling" algorithm.
  //
  // Note that it is hard to do a meaningful conversion automatically and if
  // you have a model with continuous variables, it is best if you scale the
  // domain of the variable yourself so that you have a relevant precision for
  // the application at hand. Same for the coefficients and constraint bounds.
  // ==========================================================================

  // We need to bound the maximum magnitude of the variables for CP-SAT, and
  // that is the bound we use. If the MIP model expect larger variable value in
  // the solution, then the converted model will likely not be relevant.
  optional double mip_max_bound = 124 [default = 1e7];

  // All continuous variable of the problem will be multiplied by this factor.
  // By default, we don't do any variable scaling and rely on the MIP model to
  // specify continuous variable domain with the wanted precision.
  optional double mip_var_scaling = 125 [default = 1.0];

  // If this is false, then mip_var_scaling is only applied to variables with
  // "small" domain. If it is true, we scale all floating point variable
  // independenlty of their domain.
  optional bool mip_scale_large_domain = 225 [default = false];

  // If true, some continuous variable might be automatically scaled. For now,
  // this is only the case where we detect that a variable is actually an
  // integer multiple of a constant. For instance, variables of the form k * 0.5
  // are quite frequent, and if we detect this, we will scale such variable
  // domain by 2 to make it implied integer.
  optional bool mip_automatically_scale_variables = 166 [default = true];

  // If one try to solve a MIP model with CP-SAT, because we assume all variable
  // to be integer after scaling, we will not necessarily have the correct
  // optimal. Note however that all feasible solutions are valid since we will
  // just solve a more restricted version of the original problem.
  //
  // This parameters is here to prevent user to think the solution is optimal
  // when it might not be. One will need to manually set this to false to solve
  // a MIP model where the optimal might be different.
  //
  // Note that this is tested after some MIP presolve steps, so even if not
  // all original variable are integer, we might end up with a pure IP after
  // presolve and after implied integer detection.
  optional bool only_solve_ip = 222 [default = false];

  // When scaling constraint with double coefficients to integer coefficients,
  // we will multiply by a power of 2 and round the coefficients. We will choose
  // the lowest power such that we have no potential overflow (see
  // mip_max_activity_exponent) and the worst case constraint activity error
  // does not exceed this threshold.
  //
  // Note that we also detect constraint with rational coefficients and scale
  // them accordingly when it seems better instead of using a power of 2.
  //
  // We also relax all constraint bounds by this absolute value. For pure
  // integer constraint, if this value if lower than one, this will not change
  // anything. However it is needed when scaling MIP problems.
  //
  // If we manage to scale a constraint correctly, the maximum error we can make
  // will be twice this value (once for the scaling error and once for the
  // relaxed bounds). If we are not able to scale that well, we will display
  // that fact but still scale as best as we can.
  optional double mip_wanted_precision = 126 [default = 1e-6];

  // To avoid integer overflow, we always force the maximum possible constraint
  // activity (and objective value) according to the initial variable domain to
  // be smaller than 2 to this given power. Because of this, we cannot always
  // reach the "mip_wanted_precision" parameter above.
  //
  // This can go as high as 62, but some internal algo currently abort early if
  // they might run into integer overflow, so it is better to keep it a bit
  // lower than this.
  optional int32 mip_max_activity_exponent = 127 [default = 53];

  // As explained in mip_precision and mip_max_activity_exponent, we cannot
  // always reach the wanted precision during scaling. We use this threshold to
  // enphasize in the logs when the precision seems bad.
  optional double mip_check_precision = 128 [default = 1e-4];

  // Even if we make big error when scaling the objective, we can always derive
  // a correct lower bound on the original objective by using the exact lower
  // bound on the scaled integer version of the objective. This should be fast,
  // but if you don't care about having a precise lower bound, you can turn it
  // off.
  optional bool mip_compute_true_objective_bound = 198 [default = true];

  // Any finite values in the input MIP must be below this threshold, otherwise
  // the model will be reported invalid. This is needed to avoid floating point
  // overflow when evaluating bounds * coeff for instance. We are a bit more
  // defensive, but in practice, users shouldn't use super large values in a
  // MIP.
  optional double mip_max_valid_magnitude = 199 [default = 1e20];

  // By default, any variable/constraint bound with a finite value and a
  // magnitude greater than the mip_max_valid_magnitude will result with a
  // invalid model. This flags change the behavior such that such bounds are
  // silently transformed to +\u221E or -\u221E.
  //
  // It is recommended to keep it at false, and create valid bounds.
  optional bool mip_treat_high_magnitude_bounds_as_infinity = 278
      [default = false];

  // Any value in the input mip with a magnitude lower than this will be set to
  // zero. This is to avoid some issue in LP presolving.
  optional double mip_drop_tolerance = 232 [default = 1e-16];

  // When solving a MIP, we do some basic floating point presolving before
  // scaling the problem to integer to be handled by CP-SAT. This control how
  // much of that presolve we do. It can help to better scale floating point
  // model, but it is not always behaving nicely.
  optional int32 mip_presolve_level = 261 [default = 2];
}
`;

// javascript/lib/executor_configuration.ts
var isBrowserMainThread = typeof window < "u" && typeof document < "u", isWorkerAvailable = typeof Worker < "u";
function resolveExecutorConfiguration(selection = "auto") {
  let configuration = typeof selection == "string" ? { type: selection } : selection;
  return configuration.type !== "auto" ? configuration : { type: isBrowserMainThread && isWorkerAvailable ? "worker" : "direct" };
}

// javascript/node_modules/long/index.js
var wasm = null;
try {
  wasm = new WebAssembly.Instance(
    new WebAssembly.Module(
      new Uint8Array([
        // \0asm
        0,
        97,
        115,
        109,
        // version 1
        1,
        0,
        0,
        0,
        // section "type"
        1,
        13,
        2,
        // 0, () => i32
        96,
        0,
        1,
        127,
        // 1, (i32, i32, i32, i32) => i32
        96,
        4,
        127,
        127,
        127,
        127,
        1,
        127,
        // section "function"
        3,
        7,
        6,
        // 0, type 0
        0,
        // 1, type 1
        1,
        // 2, type 1
        1,
        // 3, type 1
        1,
        // 4, type 1
        1,
        // 5, type 1
        1,
        // section "global"
        6,
        6,
        1,
        // 0, "high", mutable i32
        127,
        1,
        65,
        0,
        11,
        // section "export"
        7,
        50,
        6,
        // 0, "mul"
        3,
        109,
        117,
        108,
        0,
        1,
        // 1, "div_s"
        5,
        100,
        105,
        118,
        95,
        115,
        0,
        2,
        // 2, "div_u"
        5,
        100,
        105,
        118,
        95,
        117,
        0,
        3,
        // 3, "rem_s"
        5,
        114,
        101,
        109,
        95,
        115,
        0,
        4,
        // 4, "rem_u"
        5,
        114,
        101,
        109,
        95,
        117,
        0,
        5,
        // 5, "get_high"
        8,
        103,
        101,
        116,
        95,
        104,
        105,
        103,
        104,
        0,
        0,
        // section "code"
        10,
        191,
        1,
        6,
        // 0, "get_high"
        4,
        0,
        35,
        0,
        11,
        // 1, "mul"
        36,
        1,
        1,
        126,
        32,
        0,
        173,
        32,
        1,
        173,
        66,
        32,
        134,
        132,
        32,
        2,
        173,
        32,
        3,
        173,
        66,
        32,
        134,
        132,
        126,
        34,
        4,
        66,
        32,
        135,
        167,
        36,
        0,
        32,
        4,
        167,
        11,
        // 2, "div_s"
        36,
        1,
        1,
        126,
        32,
        0,
        173,
        32,
        1,
        173,
        66,
        32,
        134,
        132,
        32,
        2,
        173,
        32,
        3,
        173,
        66,
        32,
        134,
        132,
        127,
        34,
        4,
        66,
        32,
        135,
        167,
        36,
        0,
        32,
        4,
        167,
        11,
        // 3, "div_u"
        36,
        1,
        1,
        126,
        32,
        0,
        173,
        32,
        1,
        173,
        66,
        32,
        134,
        132,
        32,
        2,
        173,
        32,
        3,
        173,
        66,
        32,
        134,
        132,
        128,
        34,
        4,
        66,
        32,
        135,
        167,
        36,
        0,
        32,
        4,
        167,
        11,
        // 4, "rem_s"
        36,
        1,
        1,
        126,
        32,
        0,
        173,
        32,
        1,
        173,
        66,
        32,
        134,
        132,
        32,
        2,
        173,
        32,
        3,
        173,
        66,
        32,
        134,
        132,
        129,
        34,
        4,
        66,
        32,
        135,
        167,
        36,
        0,
        32,
        4,
        167,
        11,
        // 5, "rem_u"
        36,
        1,
        1,
        126,
        32,
        0,
        173,
        32,
        1,
        173,
        66,
        32,
        134,
        132,
        32,
        2,
        173,
        32,
        3,
        173,
        66,
        32,
        134,
        132,
        130,
        34,
        4,
        66,
        32,
        135,
        167,
        36,
        0,
        32,
        4,
        167,
        11
      ])
    ),
    {}
  ).exports;
} catch {
}
function Long(low, high, unsigned) {
  this.low = low | 0, this.high = high | 0, this.unsigned = !!unsigned;
}
Long.prototype.__isLong__;
Object.defineProperty(Long.prototype, "__isLong__", { value: !0 });
function isLong(obj) {
  return (obj && obj.__isLong__) === !0;
}
function ctz32(value) {
  var c = Math.clz32(value & -value);
  return value ? 31 - c : c;
}
Long.isLong = isLong;
var INT_CACHE = {}, UINT_CACHE = {};
function fromInt(value, unsigned) {
  var obj, cachedObj, cache;
  return unsigned ? (value >>>= 0, (cache = 0 <= value && value < 256) && (cachedObj = UINT_CACHE[value], cachedObj) ? cachedObj : (obj = fromBits(value, 0, !0), cache && (UINT_CACHE[value] = obj), obj)) : (value |= 0, (cache = -128 <= value && value < 128) && (cachedObj = INT_CACHE[value], cachedObj) ? cachedObj : (obj = fromBits(value, value < 0 ? -1 : 0, !1), cache && (INT_CACHE[value] = obj), obj));
}
Long.fromInt = fromInt;
function fromNumber(value, unsigned) {
  if (isNaN(value)) return unsigned ? UZERO : ZERO;
  if (unsigned) {
    if (value < 0) return UZERO;
    if (value >= TWO_PWR_64_DBL) return MAX_UNSIGNED_VALUE;
  } else {
    if (value <= -TWO_PWR_63_DBL) return MIN_VALUE;
    if (value + 1 >= TWO_PWR_63_DBL) return MAX_VALUE;
  }
  return value < 0 ? fromNumber(-value, unsigned).neg() : fromBits(
    value % TWO_PWR_32_DBL | 0,
    value / TWO_PWR_32_DBL | 0,
    unsigned
  );
}
Long.fromNumber = fromNumber;
function fromBits(lowBits, highBits, unsigned) {
  return new Long(lowBits, highBits, unsigned);
}
Long.fromBits = fromBits;
var pow_dbl = Math.pow;
function fromString(str, unsigned, radix) {
  if (str.length === 0) throw Error("empty string");
  if (typeof unsigned == "number" ? (radix = unsigned, unsigned = !1) : unsigned = !!unsigned, str === "NaN" || str === "Infinity" || str === "+Infinity" || str === "-Infinity")
    return unsigned ? UZERO : ZERO;
  if (radix = radix || 10, radix < 2 || 36 < radix) throw RangeError("radix");
  var p;
  if ((p = str.indexOf("-")) > 0) throw Error("interior hyphen");
  if (p === 0)
    return fromString(str.substring(1), unsigned, radix).neg();
  for (var radixToPower = fromNumber(pow_dbl(radix, 8)), result = ZERO, i = 0; i < str.length; i += 8) {
    var size = Math.min(8, str.length - i), value = parseInt(str.substring(i, i + size), radix);
    if (size < 8) {
      var power = fromNumber(pow_dbl(radix, size));
      result = result.mul(power).add(fromNumber(value));
    } else
      result = result.mul(radixToPower), result = result.add(fromNumber(value));
  }
  return result.unsigned = unsigned, result;
}
Long.fromString = fromString;
function fromValue(val, unsigned) {
  return typeof val == "number" ? fromNumber(val, unsigned) : typeof val == "string" ? fromString(val, unsigned) : fromBits(
    val.low,
    val.high,
    typeof unsigned == "boolean" ? unsigned : val.unsigned
  );
}
Long.fromValue = fromValue;
var TWO_PWR_16_DBL = 65536, TWO_PWR_24_DBL = 1 << 24, TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL, TWO_PWR_64_DBL = TWO_PWR_32_DBL * TWO_PWR_32_DBL, TWO_PWR_63_DBL = TWO_PWR_64_DBL / 2, TWO_PWR_24 = fromInt(TWO_PWR_24_DBL), ZERO = fromInt(0);
Long.ZERO = ZERO;
var UZERO = fromInt(0, !0);
Long.UZERO = UZERO;
var ONE = fromInt(1);
Long.ONE = ONE;
var UONE = fromInt(1, !0);
Long.UONE = UONE;
var NEG_ONE = fromInt(-1);
Long.NEG_ONE = NEG_ONE;
var MAX_VALUE = fromBits(-1, 2147483647, !1);
Long.MAX_VALUE = MAX_VALUE;
var MAX_UNSIGNED_VALUE = fromBits(-1, -1, !0);
Long.MAX_UNSIGNED_VALUE = MAX_UNSIGNED_VALUE;
var MIN_VALUE = fromBits(0, -2147483648, !1);
Long.MIN_VALUE = MIN_VALUE;
var LongPrototype = Long.prototype;
LongPrototype.toInt = function() {
  return this.unsigned ? this.low >>> 0 : this.low;
};
LongPrototype.toNumber = function() {
  return this.unsigned ? (this.high >>> 0) * TWO_PWR_32_DBL + (this.low >>> 0) : this.high * TWO_PWR_32_DBL + (this.low >>> 0);
};
LongPrototype.toString = function(radix) {
  if (radix = radix || 10, radix < 2 || 36 < radix) throw RangeError("radix");
  if (this.isZero()) return "0";
  if (this.isNegative())
    if (this.eq(MIN_VALUE)) {
      var radixLong = fromNumber(radix), div = this.div(radixLong), rem1 = div.mul(radixLong).sub(this);
      return div.toString(radix) + rem1.toInt().toString(radix);
    } else return "-" + this.neg().toString(radix);
  for (var radixToPower = fromNumber(pow_dbl(radix, 6), this.unsigned), rem = this, result = ""; ; ) {
    var remDiv = rem.div(radixToPower), intval = rem.sub(remDiv.mul(radixToPower)).toInt() >>> 0, digits = intval.toString(radix);
    if (rem = remDiv, rem.isZero()) return digits + result;
    for (; digits.length < 6; ) digits = "0" + digits;
    result = "" + digits + result;
  }
};
LongPrototype.getHighBits = function() {
  return this.high;
};
LongPrototype.getHighBitsUnsigned = function() {
  return this.high >>> 0;
};
LongPrototype.getLowBits = function() {
  return this.low;
};
LongPrototype.getLowBitsUnsigned = function() {
  return this.low >>> 0;
};
LongPrototype.getNumBitsAbs = function() {
  if (this.isNegative())
    return this.eq(MIN_VALUE) ? 64 : this.neg().getNumBitsAbs();
  for (var val = this.high != 0 ? this.high : this.low, bit = 31; bit > 0 && (val & 1 << bit) == 0; bit--) ;
  return this.high != 0 ? bit + 33 : bit + 1;
};
LongPrototype.isSafeInteger = function() {
  var top11Bits = this.high >> 21;
  return top11Bits ? this.unsigned ? !1 : top11Bits === -1 && !(this.low === 0 && this.high === -2097152) : !0;
};
LongPrototype.isZero = function() {
  return this.high === 0 && this.low === 0;
};
LongPrototype.eqz = LongPrototype.isZero;
LongPrototype.isNegative = function() {
  return !this.unsigned && this.high < 0;
};
LongPrototype.isPositive = function() {
  return this.unsigned || this.high >= 0;
};
LongPrototype.isOdd = function() {
  return (this.low & 1) === 1;
};
LongPrototype.isEven = function() {
  return (this.low & 1) === 0;
};
LongPrototype.equals = function(other) {
  return isLong(other) || (other = fromValue(other)), this.unsigned !== other.unsigned && this.high >>> 31 === 1 && other.high >>> 31 === 1 ? !1 : this.high === other.high && this.low === other.low;
};
LongPrototype.eq = LongPrototype.equals;
LongPrototype.notEquals = function(other) {
  return !this.eq(
    /* validates */
    other
  );
};
LongPrototype.neq = LongPrototype.notEquals;
LongPrototype.ne = LongPrototype.notEquals;
LongPrototype.lessThan = function(other) {
  return this.comp(
    /* validates */
    other
  ) < 0;
};
LongPrototype.lt = LongPrototype.lessThan;
LongPrototype.lessThanOrEqual = function(other) {
  return this.comp(
    /* validates */
    other
  ) <= 0;
};
LongPrototype.lte = LongPrototype.lessThanOrEqual;
LongPrototype.le = LongPrototype.lessThanOrEqual;
LongPrototype.greaterThan = function(other) {
  return this.comp(
    /* validates */
    other
  ) > 0;
};
LongPrototype.gt = LongPrototype.greaterThan;
LongPrototype.greaterThanOrEqual = function(other) {
  return this.comp(
    /* validates */
    other
  ) >= 0;
};
LongPrototype.gte = LongPrototype.greaterThanOrEqual;
LongPrototype.ge = LongPrototype.greaterThanOrEqual;
LongPrototype.compare = function(other) {
  if (isLong(other) || (other = fromValue(other)), this.eq(other)) return 0;
  var thisNeg = this.isNegative(), otherNeg = other.isNegative();
  return thisNeg && !otherNeg ? -1 : !thisNeg && otherNeg ? 1 : this.unsigned ? other.high >>> 0 > this.high >>> 0 || other.high === this.high && other.low >>> 0 > this.low >>> 0 ? -1 : 1 : this.sub(other).isNegative() ? -1 : 1;
};
LongPrototype.comp = LongPrototype.compare;
LongPrototype.negate = function() {
  return !this.unsigned && this.eq(MIN_VALUE) ? MIN_VALUE : this.not().add(ONE);
};
LongPrototype.neg = LongPrototype.negate;
LongPrototype.add = function(addend) {
  isLong(addend) || (addend = fromValue(addend));
  var a48 = this.high >>> 16, a32 = this.high & 65535, a16 = this.low >>> 16, a00 = this.low & 65535, b48 = addend.high >>> 16, b32 = addend.high & 65535, b16 = addend.low >>> 16, b00 = addend.low & 65535, c48 = 0, c32 = 0, c16 = 0, c00 = 0;
  return c00 += a00 + b00, c16 += c00 >>> 16, c00 &= 65535, c16 += a16 + b16, c32 += c16 >>> 16, c16 &= 65535, c32 += a32 + b32, c48 += c32 >>> 16, c32 &= 65535, c48 += a48 + b48, c48 &= 65535, fromBits(c16 << 16 | c00, c48 << 16 | c32, this.unsigned);
};
LongPrototype.subtract = function(subtrahend) {
  return isLong(subtrahend) || (subtrahend = fromValue(subtrahend)), this.add(subtrahend.neg());
};
LongPrototype.sub = LongPrototype.subtract;
LongPrototype.multiply = function(multiplier) {
  if (this.isZero()) return this;
  if (isLong(multiplier) || (multiplier = fromValue(multiplier)), wasm) {
    var low = wasm.mul(this.low, this.high, multiplier.low, multiplier.high);
    return fromBits(low, wasm.get_high(), this.unsigned);
  }
  if (multiplier.isZero()) return this.unsigned ? UZERO : ZERO;
  if (this.eq(MIN_VALUE)) return multiplier.isOdd() ? MIN_VALUE : ZERO;
  if (multiplier.eq(MIN_VALUE)) return this.isOdd() ? MIN_VALUE : ZERO;
  if (this.isNegative())
    return multiplier.isNegative() ? this.neg().mul(multiplier.neg()) : this.neg().mul(multiplier).neg();
  if (multiplier.isNegative()) return this.mul(multiplier.neg()).neg();
  if (this.lt(TWO_PWR_24) && multiplier.lt(TWO_PWR_24))
    return fromNumber(this.toNumber() * multiplier.toNumber(), this.unsigned);
  var a48 = this.high >>> 16, a32 = this.high & 65535, a16 = this.low >>> 16, a00 = this.low & 65535, b48 = multiplier.high >>> 16, b32 = multiplier.high & 65535, b16 = multiplier.low >>> 16, b00 = multiplier.low & 65535, c48 = 0, c32 = 0, c16 = 0, c00 = 0;
  return c00 += a00 * b00, c16 += c00 >>> 16, c00 &= 65535, c16 += a16 * b00, c32 += c16 >>> 16, c16 &= 65535, c16 += a00 * b16, c32 += c16 >>> 16, c16 &= 65535, c32 += a32 * b00, c48 += c32 >>> 16, c32 &= 65535, c32 += a16 * b16, c48 += c32 >>> 16, c32 &= 65535, c32 += a00 * b32, c48 += c32 >>> 16, c32 &= 65535, c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48, c48 &= 65535, fromBits(c16 << 16 | c00, c48 << 16 | c32, this.unsigned);
};
LongPrototype.mul = LongPrototype.multiply;
LongPrototype.divide = function(divisor) {
  if (isLong(divisor) || (divisor = fromValue(divisor)), divisor.isZero()) throw Error("division by zero");
  if (wasm) {
    if (!this.unsigned && this.high === -2147483648 && divisor.low === -1 && divisor.high === -1)
      return this;
    var low = (this.unsigned ? wasm.div_u : wasm.div_s)(
      this.low,
      this.high,
      divisor.low,
      divisor.high
    );
    return fromBits(low, wasm.get_high(), this.unsigned);
  }
  if (this.isZero()) return this.unsigned ? UZERO : ZERO;
  var approx, rem, res;
  if (this.unsigned) {
    if (divisor.unsigned || (divisor = divisor.toUnsigned()), divisor.gt(this)) return UZERO;
    if (divisor.gt(this.shru(1)))
      return UONE;
    res = UZERO;
  } else {
    if (this.eq(MIN_VALUE)) {
      if (divisor.eq(ONE) || divisor.eq(NEG_ONE))
        return MIN_VALUE;
      if (divisor.eq(MIN_VALUE)) return ONE;
      var halfThis = this.shr(1);
      return approx = halfThis.div(divisor).shl(1), approx.eq(ZERO) ? divisor.isNegative() ? ONE : NEG_ONE : (rem = this.sub(divisor.mul(approx)), res = approx.add(rem.div(divisor)), res);
    } else if (divisor.eq(MIN_VALUE)) return this.unsigned ? UZERO : ZERO;
    if (this.isNegative())
      return divisor.isNegative() ? this.neg().div(divisor.neg()) : this.neg().div(divisor).neg();
    if (divisor.isNegative()) return this.div(divisor.neg()).neg();
    res = ZERO;
  }
  for (rem = this; rem.gte(divisor); ) {
    approx = Math.max(1, Math.floor(rem.toNumber() / divisor.toNumber()));
    for (var log2 = Math.ceil(Math.log(approx) / Math.LN2), delta = log2 <= 48 ? 1 : pow_dbl(2, log2 - 48), approxRes = fromNumber(approx), approxRem = approxRes.mul(divisor); approxRem.isNegative() || approxRem.gt(rem); )
      approx -= delta, approxRes = fromNumber(approx, this.unsigned), approxRem = approxRes.mul(divisor);
    approxRes.isZero() && (approxRes = ONE), res = res.add(approxRes), rem = rem.sub(approxRem);
  }
  return res;
};
LongPrototype.div = LongPrototype.divide;
LongPrototype.modulo = function(divisor) {
  if (isLong(divisor) || (divisor = fromValue(divisor)), wasm) {
    var low = (this.unsigned ? wasm.rem_u : wasm.rem_s)(
      this.low,
      this.high,
      divisor.low,
      divisor.high
    );
    return fromBits(low, wasm.get_high(), this.unsigned);
  }
  return this.sub(this.div(divisor).mul(divisor));
};
LongPrototype.mod = LongPrototype.modulo;
LongPrototype.rem = LongPrototype.modulo;
LongPrototype.not = function() {
  return fromBits(~this.low, ~this.high, this.unsigned);
};
LongPrototype.countLeadingZeros = function() {
  return this.high ? Math.clz32(this.high) : Math.clz32(this.low) + 32;
};
LongPrototype.clz = LongPrototype.countLeadingZeros;
LongPrototype.countTrailingZeros = function() {
  return this.low ? ctz32(this.low) : ctz32(this.high) + 32;
};
LongPrototype.ctz = LongPrototype.countTrailingZeros;
LongPrototype.and = function(other) {
  return isLong(other) || (other = fromValue(other)), fromBits(this.low & other.low, this.high & other.high, this.unsigned);
};
LongPrototype.or = function(other) {
  return isLong(other) || (other = fromValue(other)), fromBits(this.low | other.low, this.high | other.high, this.unsigned);
};
LongPrototype.xor = function(other) {
  return isLong(other) || (other = fromValue(other)), fromBits(this.low ^ other.low, this.high ^ other.high, this.unsigned);
};
LongPrototype.shiftLeft = function(numBits) {
  return isLong(numBits) && (numBits = numBits.toInt()), (numBits &= 63) === 0 ? this : numBits < 32 ? fromBits(
    this.low << numBits,
    this.high << numBits | this.low >>> 32 - numBits,
    this.unsigned
  ) : fromBits(0, this.low << numBits - 32, this.unsigned);
};
LongPrototype.shl = LongPrototype.shiftLeft;
LongPrototype.shiftRight = function(numBits) {
  return isLong(numBits) && (numBits = numBits.toInt()), (numBits &= 63) === 0 ? this : numBits < 32 ? fromBits(
    this.low >>> numBits | this.high << 32 - numBits,
    this.high >> numBits,
    this.unsigned
  ) : fromBits(
    this.high >> numBits - 32,
    this.high >= 0 ? 0 : -1,
    this.unsigned
  );
};
LongPrototype.shr = LongPrototype.shiftRight;
LongPrototype.shiftRightUnsigned = function(numBits) {
  return isLong(numBits) && (numBits = numBits.toInt()), (numBits &= 63) === 0 ? this : numBits < 32 ? fromBits(
    this.low >>> numBits | this.high << 32 - numBits,
    this.high >>> numBits,
    this.unsigned
  ) : numBits === 32 ? fromBits(this.high, 0, this.unsigned) : fromBits(this.high >>> numBits - 32, 0, this.unsigned);
};
LongPrototype.shru = LongPrototype.shiftRightUnsigned;
LongPrototype.shr_u = LongPrototype.shiftRightUnsigned;
LongPrototype.rotateLeft = function(numBits) {
  var b;
  return isLong(numBits) && (numBits = numBits.toInt()), (numBits &= 63) === 0 ? this : numBits === 32 ? fromBits(this.high, this.low, this.unsigned) : numBits < 32 ? (b = 32 - numBits, fromBits(
    this.low << numBits | this.high >>> b,
    this.high << numBits | this.low >>> b,
    this.unsigned
  )) : (numBits -= 32, b = 32 - numBits, fromBits(
    this.high << numBits | this.low >>> b,
    this.low << numBits | this.high >>> b,
    this.unsigned
  ));
};
LongPrototype.rotl = LongPrototype.rotateLeft;
LongPrototype.rotateRight = function(numBits) {
  var b;
  return isLong(numBits) && (numBits = numBits.toInt()), (numBits &= 63) === 0 ? this : numBits === 32 ? fromBits(this.high, this.low, this.unsigned) : numBits < 32 ? (b = 32 - numBits, fromBits(
    this.high << b | this.low >>> numBits,
    this.low << b | this.high >>> numBits,
    this.unsigned
  )) : (numBits -= 32, b = 32 - numBits, fromBits(
    this.low << b | this.high >>> numBits,
    this.high << b | this.low >>> numBits,
    this.unsigned
  ));
};
LongPrototype.rotr = LongPrototype.rotateRight;
LongPrototype.toSigned = function() {
  return this.unsigned ? fromBits(this.low, this.high, !1) : this;
};
LongPrototype.toUnsigned = function() {
  return this.unsigned ? this : fromBits(this.low, this.high, !0);
};
LongPrototype.toBytes = function(le) {
  return le ? this.toBytesLE() : this.toBytesBE();
};
LongPrototype.toBytesLE = function() {
  var hi = this.high, lo = this.low;
  return [
    lo & 255,
    lo >>> 8 & 255,
    lo >>> 16 & 255,
    lo >>> 24,
    hi & 255,
    hi >>> 8 & 255,
    hi >>> 16 & 255,
    hi >>> 24
  ];
};
LongPrototype.toBytesBE = function() {
  var hi = this.high, lo = this.low;
  return [
    hi >>> 24,
    hi >>> 16 & 255,
    hi >>> 8 & 255,
    hi & 255,
    lo >>> 24,
    lo >>> 16 & 255,
    lo >>> 8 & 255,
    lo & 255
  ];
};
Long.fromBytes = function(bytes, unsigned, le) {
  return le ? Long.fromBytesLE(bytes, unsigned) : Long.fromBytesBE(bytes, unsigned);
};
Long.fromBytesLE = function(bytes, unsigned) {
  return new Long(
    bytes[0] | bytes[1] << 8 | bytes[2] << 16 | bytes[3] << 24,
    bytes[4] | bytes[5] << 8 | bytes[6] << 16 | bytes[7] << 24,
    unsigned
  );
};
Long.fromBytesBE = function(bytes, unsigned) {
  return new Long(
    bytes[4] << 24 | bytes[5] << 16 | bytes[6] << 8 | bytes[7],
    bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3],
    unsigned
  );
};
typeof BigInt == "function" && (Long.fromBigInt = function(value, unsigned) {
  var lowBits = Number(BigInt.asIntN(32, value)), highBits = Number(BigInt.asIntN(32, value >> BigInt(32)));
  return fromBits(lowBits, highBits, unsigned);
}, Long.fromValue = function(value, unsigned) {
  return typeof value == "bigint" ? Long.fromBigInt(value, unsigned) : fromValue(value, unsigned);
}, LongPrototype.toBigInt = function() {
  var lowBigInt = BigInt(this.low >>> 0), highBigInt = BigInt(this.unsigned ? this.high >>> 0 : this.high);
  return highBigInt << BigInt(32) | lowBigInt;
});
var long_default = Long;

// javascript/lib/protobufjs_helpers.ts
var protobufModule = __toESM(require_protobufjs(), 1);
protobufModule.util.Long = long_default;
protobufModule.configure();
function isProtobufLong(value) {
  return value !== null && typeof value == "object" && typeof value.low == "number" && typeof value.high == "number" && typeof value.unsigned == "boolean";
}
function exactLongValue(value) {
  let bigint = value.unsigned ? BigInt(value.high >>> 0) << 32n | BigInt(value.low >>> 0) : BigInt(value.high) * 0x100000000n + BigInt(value.low >>> 0);
  return bigint >= BigInt(Number.MIN_SAFE_INTEGER) && bigint <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(bigint) : {
    low: value.low,
    high: value.high,
    unsigned: value.unsigned
  };
}
function preserveExactProtobufLongs(value) {
  return isProtobufLong(value) ? exactLongValue(value) : value instanceof Uint8Array ? value : Array.isArray(value) ? value.map(preserveExactProtobufLongs) : value && typeof value == "object" ? Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, preserveExactProtobufLongs(entry)])
  ) : value;
}
function decodeProtobufWithExactLongs(type, bytes) {
  let value = type.toObject(type.decode(bytes), {
    enums: String,
    defaults: !0,
    arrays: !0,
    objects: !0
  });
  return preserveExactProtobufLongs(value);
}

// javascript/lib/cp_sat/api.ts
var protobufModule2 = __toESM(require_protobufjs(), 1);

// javascript/lib/generated/cp_model.ts
var DecisionStrategyProto_VariableSelectionStrategy = /* @__PURE__ */ ((DecisionStrategyProto_VariableSelectionStrategy2) => (DecisionStrategyProto_VariableSelectionStrategy2[DecisionStrategyProto_VariableSelectionStrategy2.CHOOSE_FIRST = 0] = "CHOOSE_FIRST", DecisionStrategyProto_VariableSelectionStrategy2[DecisionStrategyProto_VariableSelectionStrategy2.CHOOSE_LOWEST_MIN = 1] = "CHOOSE_LOWEST_MIN", DecisionStrategyProto_VariableSelectionStrategy2[DecisionStrategyProto_VariableSelectionStrategy2.CHOOSE_HIGHEST_MAX = 2] = "CHOOSE_HIGHEST_MAX", DecisionStrategyProto_VariableSelectionStrategy2[DecisionStrategyProto_VariableSelectionStrategy2.CHOOSE_MIN_DOMAIN_SIZE = 3] = "CHOOSE_MIN_DOMAIN_SIZE", DecisionStrategyProto_VariableSelectionStrategy2[DecisionStrategyProto_VariableSelectionStrategy2.CHOOSE_MAX_DOMAIN_SIZE = 4] = "CHOOSE_MAX_DOMAIN_SIZE", DecisionStrategyProto_VariableSelectionStrategy2))(DecisionStrategyProto_VariableSelectionStrategy || {}), DecisionStrategyProto_DomainReductionStrategy = /* @__PURE__ */ ((DecisionStrategyProto_DomainReductionStrategy2) => (DecisionStrategyProto_DomainReductionStrategy2[DecisionStrategyProto_DomainReductionStrategy2.SELECT_MIN_VALUE = 0] = "SELECT_MIN_VALUE", DecisionStrategyProto_DomainReductionStrategy2[DecisionStrategyProto_DomainReductionStrategy2.SELECT_MAX_VALUE = 1] = "SELECT_MAX_VALUE", DecisionStrategyProto_DomainReductionStrategy2[DecisionStrategyProto_DomainReductionStrategy2.SELECT_LOWER_HALF = 2] = "SELECT_LOWER_HALF", DecisionStrategyProto_DomainReductionStrategy2[DecisionStrategyProto_DomainReductionStrategy2.SELECT_UPPER_HALF = 3] = "SELECT_UPPER_HALF", DecisionStrategyProto_DomainReductionStrategy2[DecisionStrategyProto_DomainReductionStrategy2.SELECT_MEDIAN_VALUE = 4] = "SELECT_MEDIAN_VALUE", DecisionStrategyProto_DomainReductionStrategy2[DecisionStrategyProto_DomainReductionStrategy2.SELECT_RANDOM_HALF = 5] = "SELECT_RANDOM_HALF", DecisionStrategyProto_DomainReductionStrategy2))(DecisionStrategyProto_DomainReductionStrategy || {}), CpSolverStatus = /* @__PURE__ */ ((CpSolverStatus2) => (CpSolverStatus2[CpSolverStatus2.UNKNOWN = 0] = "UNKNOWN", CpSolverStatus2[CpSolverStatus2.MODEL_INVALID = 1] = "MODEL_INVALID", CpSolverStatus2[CpSolverStatus2.FEASIBLE = 2] = "FEASIBLE", CpSolverStatus2[CpSolverStatus2.INFEASIBLE = 3] = "INFEASIBLE", CpSolverStatus2[CpSolverStatus2.OPTIMAL = 4] = "OPTIMAL", CpSolverStatus2))(CpSolverStatus || {});

// javascript/lib/cp_sat/api.ts
var isBrowserMainThread2 = typeof window < "u" && typeof document < "u";
async function createCpSatWorker() { throw new Error("Use the sfinder-wasm primary Worker with executor=direct.");
}
var directCpSatExecutor = new DirectCpSatExecutor(), workerCpSatExecutor = new SolverWorkerExecutor(
  cpSatProtocol,
  createCpSatWorker,
  !0
), ignoreCpSatProgress = () => {
};
function createCpSatExecutor(selection = "auto") {
  return createResolvedCpSatExecutor(resolveExecutorConfiguration(selection));
}
function createResolvedCpSatExecutor(executor) {
  switch (executor.type) {
    case "direct":
      return directCpSatExecutor;
    case "worker":
      return workerCpSatExecutor;
    case "server":
      return new SolverServerExecutor(cpSatProtocol, executor);
    case "cloud":
      return new CloudExecutor("cp-sat", { test: executor.test });
  }
}
var protobufContext;
function createProtobufContext() {
  let schemas = {
    cp_model: cpModelProtoSchema,
    sat_parameters: satParametersProtoSchema
  }, modelRoot = protobufModule2.parse(schemas.cp_model).root, parametersRoot = protobufModule2.parse(schemas.sat_parameters).root;
  return {
    schemas,
    modelType: modelRoot.lookupType("operations_research.sat.CpModelProto"),
    responseType: modelRoot.lookupType("operations_research.sat.CpSolverResponse"),
    parametersType: parametersRoot.lookupType("operations_research.sat.SatParameters")
  };
}
function getProtobufContext() {
  return protobufContext ?? (protobufContext = createProtobufContext());
}
async function getSchemas() {
  return getProtobufContext().schemas;
}
function encodeSatParameters(parametersType, params) {
  let unknownParameter = Object.keys(params).find(
    (name) => parametersType.fields[name] === void 0
  );
  if (unknownParameter)
    throw new Error(`CpSat.solve: unknown solver parameter "${unknownParameter}".`);
  let validationError = parametersType.verify(params);
  if (validationError)
    throw new Error(`CpSat.solve: ${validationError}`);
  let message = parametersType.create(params);
  return parametersType.encode(message).finish();
}
function toCpSolverResponse(solverType, bytes) {
  return decodeProtobufWithExactLongs(solverType, bytes);
}
function decodeCpSatEvent(solverType, event) {
  if (event.type === "solution") {
    let bytes = event.response;
    return { type: "solution", response: toCpSolverResponse(solverType, bytes), bytes };
  }
  return event;
}
function createAbortError(signal) {
  if (signal.reason instanceof Error)
    return signal.reason;
  if (signal.reason !== void 0)
    return new Error(String(signal.reason));
  if (typeof DOMException < "u")
    return new DOMException("The CP-SAT solve was aborted.", "AbortError");
  let error = new Error("The CP-SAT solve was aborted.");
  return error.name = "AbortError", error;
}
function throwIfAborted(signal) {
  if (signal?.aborted)
    throw createAbortError(signal);
}
function normalizeCpModelForProtobuf(model) {
  return {
    ...model,
    constraints: model.constraints?.map((constraint) => {
      if (!constraint.noOverlap2d)
        return constraint;
      let normalized = {
        ...constraint,
        noOverlap_2d: constraint.noOverlap2d
      };
      return delete normalized.noOverlap2d, normalized;
    })
  };
}
async function createModel(model) {
  let { modelType: type } = getProtobufContext(), protobufModel = normalizeCpModelForProtobuf(model), validationError = type.verify(protobufModel);
  if (validationError)
    throw new Error(`CpSat.createModel: ${validationError}`);
  let message = type.create(protobufModel);
  return type.encode(message).finish();
}
async function modelStats(model) {
  let { modelType: type } = getProtobufContext(), decoded = type.decode(model), object = type.toObject(decoded, {
    enums: String,
    longs: Number,
    defaults: !0,
    arrays: !0,
    objects: !0
  });
  return JSON.stringify({
    name: object.name ?? "",
    variables: object.variables?.length ?? 0,
    constraints: object.constraints?.length ?? 0,
    hasObjective: object.objective !== void 0 || object.floatingPointObjective !== void 0
  });
}
async function executeSolve(modelBytes, options) {
  throwIfAborted(options.signal);
  let eventMask = options.onEvent ? options.eventMask ?? { solution: !0, bestBound: !0, log: !0 } : {}, executor = options.executor, callbackError = null, abortError = null, onEvent = async (event) => {
    if (callbackError) return;
    let mappedEvent = decodeCpSatEvent(options.solverType, event);
    try {
      await options.onEvent?.(mappedEvent);
    } catch (error) {
      callbackError = error;
    }
  }, job = executor.execute({
    type: "solve",
    model: modelBytes,
    parameters: options.solverParametersBytes,
    callbacks: {
      solution: !!eventMask.solution,
      bestBound: !!eventMask.bestBound,
      log: !!eventMask.log
    }
  }, { resources: options.resources, onEvent }), abortSolve = () => {
    options.signal && (abortError = createAbortError(options.signal), job.cancel().catch(() => {
    }));
  };
  options.signal?.addEventListener("abort", abortSolve, { once: !0 }), options.signal?.aborted && abortSolve();
  try {
    let response = await job.result;
    if (callbackError)
      throw callbackError;
    if (abortError)
      throw abortError;
    if (response.type !== "solve")
      throw new Error("CP-SAT executor returned the wrong solve payload.");
    return response.response;
  } finally {
    options.signal?.removeEventListener("abort", abortSolve);
  }
}
function schedulerResourcesFromParameters(parameters) {
  let threads = parameters.numWorkers;
  return threads !== void 0 && threads > 0 ? { threads } : void 0;
}
async function solve(modelBytes, options = {}) {
  let {
    executor,
    onEvent,
    eventMask,
    signal,
    ...solverParameters
  } = options;
  if (solverParameters.numSearchWorkers !== void 0)
    throw new Error("numSearchWorkers is not supported; use numWorkers.");
  let { parametersType, responseType } = getProtobufContext(), solverParametersBytes = encodeSatParameters(parametersType, solverParameters), bytes = await executeSolve(modelBytes, {
    executor: createCpSatExecutor(executor),
    solverParametersBytes,
    solverType: responseType,
    onEvent,
    eventMask,
    resources: schedulerResourcesFromParameters(solverParameters),
    signal
  }), response = bytes.length > 0 ? toCpSolverResponse(responseType, bytes) : null;
  return { bytes, response };
}
async function validate(model, options = {}) {
  throwIfAborted(options.signal);
  let job = createCpSatExecutor(options.executor).execute({
    type: "validate",
    model
  }, { onEvent: ignoreCpSatProgress }), abortError = null, abortValidation = () => {
    options.signal && (abortError = createAbortError(options.signal), job.cancel().catch(() => {
    }));
  };
  options.signal?.addEventListener("abort", abortValidation, { once: !0 }), options.signal?.aborted && abortValidation();
  let response;
  try {
    if (response = await job.result, abortError) throw abortError;
  } finally {
    options.signal?.removeEventListener("abort", abortValidation);
  }
  if (response.type !== "validate")
    throw new Error("CP-SAT executor returned the wrong validate payload.");
  return {
    ok: response.ok,
    message: response.message
  };
}
var CpSat = {
  solve: (model, options = {}) => solve(model, options),
  validate,
  modelStats,
  getSchemas,
  createModel
};
isBrowserMainThread2 && (window.CpSat = CpSat);
var api_default = CpSat;

// javascript/lib/cp-sat.ts
import { terminateLoadedRuntimeThreads as terminateLoadedRuntimeThreads2 } from "./runtime_loader.js";

// javascript/lib/cp_sat/high_level_api.ts
var INT64_MIN = { low: 0, high: -2147483648 }, INT64_MAX = { low: -1, high: 2147483647 };
function assert(condition, message) {
  if (!condition)
    throw new Error(message);
}
var ValueError = class extends Error {
  constructor(message) {
    super(message), this.name = "ValueError";
  }
}, RuntimeError = class extends Error {
  constructor(message) {
    super(message), this.name = "RuntimeError";
  }
}, ArithmeticError = class extends Error {
  constructor(message) {
    super(message), this.name = "ArithmeticError";
  }
}, NotImplementedError = class extends Error {
  constructor(message) {
    super(message), this.name = "NotImplementedError";
  }
};
function valueError(condition, message) {
  if (!condition)
    throw new ValueError(message);
}
function runtimeError(condition, message) {
  if (!condition)
    throw new RuntimeError(message);
}
function asInt64(value) {
  return assert(Number.isInteger(value), `expected integer value, got ${value}`), value;
}
function normalizeInt64(value) {
  return typeof value == "number" ? asInt64(value) : value;
}
function int64ObjectToBigInt(value) {
  return BigInt(value.high) * 0x100000000n + BigInt(value.low >>> 0);
}
function protoInt64ToBigInt(value) {
  return typeof value == "number" || typeof value == "string" ? BigInt(value) : int64ObjectToBigInt(value);
}
function protoInt64ToString(value) {
  return protoInt64ToBigInt(value).toString();
}
function compareProtoInt64(left, right) {
  let leftValue = protoInt64ToBigInt(left), rightValue = protoInt64ToBigInt(right);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}
function bigintToProtoInt64(value) {
  return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : {
    low: Number(BigInt.asIntN(32, value)),
    high: Number(BigInt.asIntN(32, value >> 32n))
  };
}
function isInt64Min(value) {
  return value === "-9223372036854775808" || typeof value == "object" && value.low === 0 && value.high === -2147483648;
}
function isInt64Max(value) {
  return value === "9223372036854775807" || typeof value == "object" && value.low === -1 && value.high === 2147483647;
}
function isProtoInt64Object(value) {
  return typeof value == "object" && value !== null && "low" in value && "high" in value && typeof value.low == "number" && typeof value.high == "number";
}
function isProtoInt64String(value) {
  return typeof value == "string" && /^-?\d+$/.test(value);
}
function isProtoInt64Constant(value) {
  return typeof value == "number" || isProtoInt64String(value) || isProtoInt64Object(value);
}
function adjustedProtoInt64ToBigInt(value, offset) {
  return protoInt64ToBigInt(value) - BigInt(offset);
}
function adjustedProtoInt64ToString(value, offset) {
  return Number.isInteger(offset) ? adjustedProtoInt64ToBigInt(value, offset).toString() : String(protoInt64ToNumber(value) - offset);
}
function compareAdjustedProtoInt64(left, right, offset) {
  if (!Number.isInteger(offset)) {
    let leftValue2 = protoInt64ToNumber(left) - offset, rightValue2 = protoInt64ToNumber(right) - offset;
    return leftValue2 < rightValue2 ? -1 : leftValue2 > rightValue2 ? 1 : 0;
  }
  let leftValue = adjustedProtoInt64ToBigInt(left, offset), rightValue = adjustedProtoInt64ToBigInt(right, offset);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}
function adjustDomainEndpoint(value, offset) {
  return isInt64Min(value) || isInt64Max(value) ? value : typeof value == "number" ? asInt64(value - offset) : bigintToProtoInt64(typeof value == "string" ? BigInt(value) - BigInt(offset) : int64ObjectToBigInt(value) - BigInt(offset));
}
function protoInt64ToNumber(value) {
  return value === void 0 ? 0 : typeof value == "number" ? value : typeof value == "string" ? Number(value) : value.high * 4294967296 + (value.low >>> 0);
}
function cloneProto(value) {
  return JSON.parse(JSON.stringify(value));
}
function rebuildFromLinearExpressionProto(proto, _modelProto) {
  let vars = proto.vars ?? [], coeffs = proto.coeffs ?? [];
  if (valueError(vars.length === coeffs.length, "linear expression proto vars and coeffs must have the same length"), vars.length === 0)
    return protoInt64ToNumber(proto.offset);
  let terms = /* @__PURE__ */ new Map();
  for (let index = 0; index < vars.length; index += 1)
    terms.set(vars[index], Number(protoInt64ToNumber(coeffs[index])));
  return new LinearExpr(null, terms, protoInt64ToNumber(proto.offset));
}
function rebuild_from_linear_expression_proto(proto, modelProto) {
  return rebuildFromLinearExpressionProto(proto, modelProto);
}
function evaluateLinearExpression(response, expression) {
  let expr = LinearExpr.from(expression), value = expr.offset;
  for (let [index, coeff] of expr.terms) {
    let variableValue = response.solution?.[index];
    assert(typeof variableValue == "number", `missing numeric solution value for variable ${index}`), value += coeff * variableValue;
  }
  return value;
}
function evaluateBooleanLiteral(response, literal) {
  if (typeof literal == "number")
    return literal !== 0;
  if (literal === !0 || literal === !1)
    return literal;
  let index = literal instanceof NotBoolVar ? literal.variable.index : literal.index, value = response.solution?.[index];
  assert(typeof value == "number", `missing numeric solution value for literal ${index}`);
  let truth = value !== 0;
  return literal instanceof NotBoolVar ? !truth : truth;
}
function literalIndex(literal) {
  if (typeof literal == "number") {
    if (literal === 0) return !1;
    if (literal === 1) return !0;
    throw new TypeError("literal numeric constants must be 0 or 1");
  }
  if (literal === !0) return !0;
  if (literal === !1) return !1;
  if (!(literal instanceof BoolVar || literal instanceof NotBoolVar))
    throw new TypeError("literal must be a Boolean variable or its negation");
  return literal.index;
}
function objectIsATrueLiteral(literal) {
  if (literal instanceof IntVar) {
    let domain = literal.model.proto().variables?.[literal.index]?.domain ?? [];
    return domain.length === 2 && protoInt64ToNumber(domain[0]) === 1 && protoInt64ToNumber(domain[1]) === 1;
  }
  if (literal instanceof NotBoolVar) {
    let domain = literal.variable.model.proto().variables?.[literal.variable.index]?.domain ?? [];
    return domain.length === 2 && protoInt64ToNumber(domain[0]) === 0 && protoInt64ToNumber(domain[1]) === 0;
  }
  return typeof literal == "boolean" ? literal : typeof literal == "number" && Number.isInteger(literal) ? literal === 1 || literal === -1 : !1;
}
function object_is_a_true_literal(literal) {
  return objectIsATrueLiteral(literal);
}
function objectIsAFalseLiteral(literal) {
  if (literal instanceof IntVar) {
    let domain = literal.model.proto().variables?.[literal.index]?.domain ?? [];
    return domain.length === 2 && protoInt64ToNumber(domain[0]) === 0 && protoInt64ToNumber(domain[1]) === 0;
  }
  if (literal instanceof NotBoolVar) {
    let domain = literal.variable.model.proto().variables?.[literal.variable.index]?.domain ?? [];
    return domain.length === 2 && protoInt64ToNumber(domain[0]) === 1 && protoInt64ToNumber(domain[1]) === 1;
  }
  return typeof literal == "boolean" ? !literal : typeof literal == "number" && Number.isInteger(literal) ? literal === 0 || literal === -2 : !1;
}
function object_is_a_false_literal(literal) {
  return objectIsAFalseLiteral(literal);
}
function requireSameModel(model, owner, what) {
  if (model !== owner)
    throw new Error(`${what} belongs to a different CpModel`);
}
function mergeTerms(terms, index, coeff) {
  let next = (terms.get(index) ?? 0) + coeff;
  next === 0 ? terms.delete(index) : terms.set(index, next);
}
function variableDisplayName(model, index) {
  return model?.proto().variables?.[index]?.name || `var${index}`;
}
function renderLinearExprDisplay(node, model) {
  switch (node.kind) {
    case "const":
      return String(node.value);
    case "var":
      return variableDisplayName(model, node.index);
    case "not":
      return `not(${variableDisplayName(model, node.index)})`;
    case "mul": {
      let value = renderLinearExprDisplay(node.value, model);
      return node.coeff === 1 ? value : node.coeff === -1 ? `(-${value})` : `(${node.coeff} * ${value})`;
    }
    case "sum":
      return formatDisplaySum(node.values, model);
    case "weighted":
      return formatWeightedDisplaySum(node.values, node.coeffs, model);
  }
}
function renderLinearExprDisplayRepr(node, model) {
  switch (node.kind) {
    case "const":
      return Number.isInteger(node.value) ? `IntConstant(${node.value})` : `FloatConstant(${node.value})`;
    case "var":
      return model?.getIntVarFromProtoIndex(node.index)?.repr() ?? `var${node.index}`;
    case "not":
      return `NotBooleanVariable(var_index=${node.index})`;
    case "mul": {
      let valueRepr = renderLinearExprDisplayRepr(node.value, model);
      return `${Number.isInteger(node.coeff) ? "IntAffine" : "FloatAffine"}(expr=${valueRepr}, coeff=${node.coeff}, offset=0)`;
    }
    case "sum": {
      let values = [], integerOffset = 0, floatOffset = 0, hasFloatOffset = !1;
      for (let value of node.values)
        value.kind === "const" ? Number.isInteger(value.value) && !hasFloatOffset ? integerOffset += value.value : (hasFloatOffset = !0, floatOffset += value.value) : values.push(renderLinearExprDisplayRepr(value, model));
      return hasFloatOffset ? `SumArray(${values.join(", ")}, float_offset=${floatOffset + integerOffset})` : integerOffset !== 0 ? `SumArray(${values.join(", ")}, int_offset=${integerOffset})` : `SumArray(${values.join(", ")})`;
    }
    case "weighted":
      return `WeightedSum(${node.values.map((value) => renderLinearExprDisplayRepr(value, model)).join(", ")}, coeffs=[${node.coeffs.join(", ")}])`;
  }
}
function formatDisplaySum(values, model) {
  let nonConstantValues = [], constant = 0;
  for (let value of values)
    value.kind === "const" ? constant += value.value : nonConstantValues.push(value);
  if ((constant !== 0 || nonConstantValues.length === 0) && nonConstantValues.push({ kind: "const", value: constant }), nonConstantValues.length === 0)
    return "0";
  let [first, ...rest] = nonConstantValues, text = renderLinearExprDisplay(first, model);
  for (let value of rest)
    value.kind === "const" && value.value < 0 ? text += ` - ${Math.abs(value.value)}` : text += ` + ${renderLinearExprDisplay(value, model)}`;
  return nonConstantValues.length > 1 ? `(${text})` : text;
}
function formatWeightedDisplaySum(values, coeffs, model) {
  let pieces = [];
  for (let index = 0; index < values.length; index += 1) {
    let coeff = coeffs[index];
    if (coeff === 0)
      continue;
    let value = values[index];
    if (value.kind === "const") {
      let scaled = value.value * coeff;
      scaled !== 0 && pieces.push({ sign: scaled < 0 ? -1 : 1, text: String(Math.abs(scaled)) });
      continue;
    }
    let sign = coeff < 0 ? -1 : 1, absCoeff = Math.abs(coeff), valueText = renderLinearExprDisplay(value, model);
    pieces.push({ sign, text: absCoeff === 1 ? valueText : `${absCoeff} * ${valueText}` });
  }
  if (pieces.length === 0)
    return "0";
  let [first, ...rest] = pieces, text = first.sign < 0 ? `-${first.text}` : first.text;
  for (let piece of rest)
    text += piece.sign < 0 ? ` - ${piece.text}` : ` + ${piece.text}`;
  return pieces.length > 1 || pieces[0].sign < 0 ? `(${text})` : text;
}
function appendDisplaySumValues(values, node) {
  node.kind === "sum" ? values.push(...node.values) : values.push(node);
}
function unsupportedNativeOperatorCoercion() {
  throw new NotImplementedError("native JavaScript operators are not supported for CP-SAT expressions; use the explicit high-level API methods");
}
function expressionList(first, rest) {
  return rest.length > 0 ? [first, ...rest] : typeof first == "number" || first instanceof IntVar || first instanceof NotBoolVar || first instanceof LinearExpr ? [first] : Array.from(first);
}
function iterableValues(first, rest) {
  return rest.length > 0 ? [first, ...rest] : typeof first == "number" || first instanceof IntVar || first instanceof NotBoolVar || first instanceof LinearExpr ? [first] : Array.from(first);
}
function literalList(first, rest) {
  return rest.length > 0 ? [first, ...rest] : typeof first == "number" || typeof first == "boolean" || first instanceof BoolVar || first instanceof NotBoolVar ? [first] : Array.from(first);
}
var LinearExpr = class _LinearExpr {
  constructor(model, terms = /* @__PURE__ */ new Map(), offset = 0, display = null) {
    this.model = model, this.terms = new Map(terms), this.offset = offset, this.display = display;
  }
  static constant(value) {
    return new _LinearExpr(null, /* @__PURE__ */ new Map(), value, { kind: "const", value });
  }
  static sum(values, ...rest) {
    return sum(values, ...rest);
  }
  static Sum(values, ...rest) {
    return _LinearExpr.sum(values, ...rest);
  }
  static weightedSum(values, coeffs) {
    return weightedSum(values, coeffs);
  }
  static weighted_sum(values, coeffs) {
    return _LinearExpr.weightedSum(values, coeffs);
  }
  static WeightedSum(values, coeffs) {
    return _LinearExpr.weightedSum(values, coeffs);
  }
  static term(variable, coeff) {
    return term(variable, coeff);
  }
  static Term(variable, coeff) {
    return _LinearExpr.term(variable, coeff);
  }
  static affine(expression, coeff, offset) {
    return _LinearExpr.from(expression).times(coeff).plus(offset);
  }
  static from(value) {
    if (typeof value == "number")
      return _LinearExpr.constant(value);
    if (value instanceof _LinearExpr)
      return value;
    if (value instanceof NotBoolVar)
      return value.expr();
    if (!(value instanceof IntVar))
      throw new TypeError("expected integer variable or linear expression");
    return value.expr();
  }
  plus(value, coeff = 1) {
    let other = coeff === 1 ? _LinearExpr.from(value) : _LinearExpr.from(value).times(coeff), model = this.model ?? other.model;
    this.model && other.model && requireSameModel(this.model, other.model, "linear expression");
    let terms = new Map(this.terms);
    for (let [index, termCoeff] of other.terms)
      mergeTerms(terms, index, termCoeff);
    let displayValues = [];
    return appendDisplaySumValues(displayValues, this.displayNodeForRendering()), appendDisplaySumValues(displayValues, other.displayNodeForRendering()), new _LinearExpr(model, terms, this.offset + other.offset, { kind: "sum", values: displayValues });
  }
  minus(value) {
    return this.plus(value, -1);
  }
  times(coeff) {
    if (typeof coeff != "number" || !Number.isFinite(coeff))
      throw new TypeError(`expected finite numeric coefficient, got ${coeff}`);
    let terms = /* @__PURE__ */ new Map();
    for (let [index, termCoeff] of this.terms)
      mergeTerms(terms, index, termCoeff * coeff);
    let displayCoeff = coeff, displayValue = this.displayNodeForRendering();
    return displayValue.kind === "mul" && (displayCoeff *= displayValue.coeff, displayValue = displayValue.value), new _LinearExpr(this.model, terms, this.offset * coeff, {
      kind: "mul",
      coeff: displayCoeff,
      value: displayValue
    });
  }
  neg() {
    return this.times(-1);
  }
  abs() {
    throw new NotImplementedError(
      "calling abs() on a linear expression is not supported, please use CpModel.add_abs_equality"
    );
  }
  __abs__() {
    return this.abs();
  }
  div(_value) {
    throw new NotImplementedError(
      "calling // on a linear expression is not supported, please use CpModel.add_division_equality"
    );
  }
  __div__(value) {
    return this.div(value);
  }
  truediv(_value) {
    return this.div(_value);
  }
  __truediv__(value) {
    return this.truediv(value);
  }
  mod(_value) {
    throw new NotImplementedError(
      "calling %% on a linear expression is not supported, please use CpModel.add_modulo_equality"
    );
  }
  __mod__(value) {
    return this.mod(value);
  }
  __pow__(_value) {
    throw new NotImplementedError("calling ** on a linear expression is not supported");
  }
  __lshift__(_value) {
    throw new NotImplementedError("calling << on a linear expression is not supported");
  }
  __rshift__(_value) {
    throw new NotImplementedError("calling >> on a linear expression is not supported");
  }
  __and__(_value) {
    throw new NotImplementedError("calling & on a linear expression is not supported");
  }
  __or__(_value) {
    throw new NotImplementedError("calling | on a linear expression is not supported");
  }
  __xor__(_value) {
    throw new NotImplementedError("calling ^ on a linear expression is not supported");
  }
  eq(value) {
    return new BoundedLinearExpr(this.minus(value), 0, 0);
  }
  ne(value) {
    return isProtoInt64Constant(value) && isInt64Min(value) ? new BoundedLinearExpr(this, bigintToProtoInt64(-9223372036854775807n), INT64_MAX) : isProtoInt64Constant(value) && isInt64Max(value) ? new BoundedLinearExpr(this, INT64_MIN, bigintToProtoInt64(9223372036854775806n)) : new BoundedLinearExpr(this.minus(value), INT64_MIN, -1, [INT64_MIN, -1, 1, INT64_MAX]);
  }
  le(value) {
    return isProtoInt64Constant(value) ? new BoundedLinearExpr(this, INT64_MIN, value) : new BoundedLinearExpr(this.minus(value), INT64_MIN, 0);
  }
  lt(value) {
    if (isProtoInt64Constant(value) && isInt64Min(value))
      throw new ArithmeticError("integer expressions cannot be less than INT_MIN");
    return new BoundedLinearExpr(this.minus(value), INT64_MIN, -1);
  }
  ge(value) {
    return isProtoInt64Constant(value) ? new BoundedLinearExpr(this, value, INT64_MAX) : new BoundedLinearExpr(this.minus(value), 0, INT64_MAX);
  }
  gt(value) {
    if (isProtoInt64Constant(value) && isInt64Max(value))
      throw new ArithmeticError("integer expressions cannot be greater than INT_MAX");
    return new BoundedLinearExpr(this.minus(value), 1, INT64_MAX);
  }
  toProto() {
    let vars = [], coeffs = [];
    for (let [index, coeff] of this.terms)
      vars.push(index), coeffs.push(asInt64(coeff));
    let proto = { vars, coeffs };
    return this.offset !== 0 && (proto.offset = asInt64(this.offset)), proto;
  }
  toString() {
    if (this.display)
      return renderLinearExprDisplay(this.display, this.model);
    if (this.terms.size === 1 && this.offset !== 0) {
      let [[index, coeff]] = Array.from(this.terms), variable = this.model?.getIntVarFromProtoIndex(index);
      if (variable instanceof BoolVar && coeff === -this.offset)
        return `(${this.offset} * not(${variable}))`;
    }
    let pieces = [], singleTermNeedsParens = !1;
    for (let [index, coeff] of this.terms) {
      let name = this.model?.proto().variables?.[index]?.name || `var${index}`;
      coeff === 1 ? pieces.push(name) : coeff === -1 ? (pieces.push(`-${name}`), singleTermNeedsParens = !0) : (pieces.push(`${coeff} * ${name}`), singleTermNeedsParens = !0);
    }
    (this.offset !== 0 || pieces.length === 0) && (pieces.push(String(this.offset)), singleTermNeedsParens = !1);
    let [first, ...rest] = pieces, value = rest.reduce((text, piece) => piece.startsWith("-") ? `${text} - ${piece.slice(1)}` : `${text} + ${piece}`, first);
    return pieces.length > 1 || singleTermNeedsParens ? `(${value})` : value;
  }
  [Symbol.toPrimitive](hint) {
    return hint === "string" ? this.toString() : unsupportedNativeOperatorCoercion();
  }
  displayNodeForRendering() {
    if (this.display)
      return this.display;
    if (this.terms.size === 0)
      return { kind: "const", value: this.offset };
    let values = Array.from(this.terms, ([index, coeff]) => {
      let variable = { kind: "var", index };
      return coeff === 1 ? variable : { kind: "mul", coeff, value: variable };
    });
    return this.offset !== 0 && values.push({ kind: "const", value: this.offset }), values.length === 1 ? values[0] : { kind: "sum", values };
  }
  hasFloatingPointTerms() {
    return this.offset !== 0 && !Number.isInteger(this.offset) || Array.from(this.terms.values()).some((coeff) => !Number.isInteger(coeff));
  }
  isInteger() {
    return !this.hasFloatingPointTerms();
  }
  is_integer() {
    return this.isInteger();
  }
  repr() {
    if (this.terms.size === 0)
      return Number.isInteger(this.offset) ? `IntConstant(${this.offset})` : `FloatConstant(${this.offset})`;
    if (this.terms.size === 1) {
      let [[index, coeff]] = Array.from(this.terms);
      if (coeff === 1 && this.offset === 0)
        return this.model?.getIntVarFromProtoIndex(index)?.repr() ?? String(this);
      let variableRepr = this.model?.getIntVarFromProtoIndex(index)?.repr() ?? `var${index}`;
      return Number.isInteger(coeff) && Number.isInteger(this.offset) ? `IntAffine(expr=${variableRepr}, coeff=${coeff}, offset=${this.offset})` : `FloatAffine(expr=${variableRepr}, coeff=${coeff}, offset=${this.offset})`;
    }
    if (this.display?.kind === "sum")
      return renderLinearExprDisplayRepr(this.display, this.model);
    let variables = Array.from(this.terms, ([index]) => this.model?.getIntVarFromProtoIndex(index)?.repr() ?? `var${index}`), coeffs = Array.from(this.terms.values());
    return this.offset === 0 && coeffs.every((coeff) => coeff === 1) ? `SumArray(${variables.join(", ")})` : coeffs.every((coeff) => Number.isInteger(coeff)) && Number.isInteger(this.offset) ? `IntWeightedSum([${variables.join(", ")}], [${coeffs.join(", ")}], ${this.offset})` : `FloatWeightedSum([${variables.join(", ")}], [${coeffs.join(", ")}], ${this.offset})`;
  }
  toFloatObjective(maximize = !1) {
    return {
      vars: Array.from(this.terms.keys()),
      coeffs: Array.from(this.terms.values()),
      offset: this.offset,
      maximize
    };
  }
}, BoundedLinearExpr = class {
  constructor(expression, lowerBound, upperBound, domain) {
    this.expression = expression;
    this.lowerBound = lowerBound;
    this.upperBound = upperBound;
    this.domain = domain;
  }
  toString() {
    let normalizedExpression = new LinearExpr(this.expression.model, this.expression.terms, 0), expressionText = String(normalizedExpression), lower = adjustedProtoInt64ToString(this.lowerBound, this.expression.offset), upper = adjustedProtoInt64ToString(this.upperBound, this.expression.offset);
    if (this.domain !== void 0) {
      if (this.domain.length === 4 && isInt64Min(this.domain[0]) && protoInt64ToNumber(this.domain[1]) === -1 && protoInt64ToNumber(this.domain[2]) === 1 && isInt64Max(this.domain[3]))
        return `${expressionText} != ${-this.expression.offset}`;
      let [firstLower, firstUpper, secondLower, secondUpper] = this.domain.map(
        (value) => adjustedProtoInt64ToString(value, this.expression.offset)
      );
      if (isInt64Min(this.domain[0]) && secondLower !== void 0 && isInt64Max(this.domain[3])) {
        let firstUpperEnd = (BigInt(firstUpper) + 1n).toString(), secondLowerStart = (BigInt(secondLower) - 1n).toString();
        return `(${expressionText}) not in [${firstUpperEnd}, ${secondLowerStart}]`;
      }
      return `${expressionText} in [${[firstLower, firstUpper, secondLower, secondUpper].filter((value) => value !== void 0).join(", ")}]`;
    }
    return isInt64Min(this.lowerBound) && isInt64Max(this.upperBound) ? `True (unbounded expr ${expressionText})` : isInt64Min(this.lowerBound) ? `${expressionText} <= ${upper}` : isInt64Max(this.upperBound) ? `${expressionText} >= ${lower}` : compareAdjustedProtoInt64(this.lowerBound, this.upperBound, this.expression.offset) === 0 ? `${expressionText} == ${lower}` : `${lower} <= ${expressionText} <= ${upper}`;
  }
  [Symbol.toPrimitive](hint) {
    return hint === "string" ? this.toString() : unsupportedNativeOperatorCoercion();
  }
}, BoundedLinearExpression = class extends BoundedLinearExpr {
  constructor(expression, domain) {
    let linear = LinearExpr.from(expression);
    valueError(domain instanceof Domain, "domain must be a Domain");
    let flatDomain = domain.flatIntervals;
    valueError(flatDomain.length >= 2 && flatDomain.length % 2 === 0, "domain must contain complete intervals"), flatDomain.length === 2 ? super(linear, flatDomain[0], flatDomain[1]) : super(linear, flatDomain[0], flatDomain[flatDomain.length - 1], flatDomain);
  }
}, IntVar = class {
  constructor(model, index, _name = "") {
    this.model = model;
    this.index = index;
  }
  get name() {
    return this.model.proto().variables?.[this.index]?.name ?? "";
  }
  get model_proto() {
    return this.model.proto();
  }
  expr() {
    return new LinearExpr(this.model, /* @__PURE__ */ new Map([[this.index, 1]]), 0, { kind: "var", index: this.index });
  }
  plus(value, coeff = 1) {
    return this.expr().plus(value, coeff);
  }
  __add__(value) {
    return this.plus(value);
  }
  minus(value) {
    return this.expr().minus(value);
  }
  times(coeff) {
    return this.expr().times(coeff);
  }
  __mul__(coeff) {
    return this.times(coeff);
  }
  neg() {
    return this.expr().neg();
  }
  abs() {
    return this.expr().abs();
  }
  __abs__() {
    return this.abs();
  }
  div(value) {
    return this.expr().div(value);
  }
  __div__(value) {
    return this.div(value);
  }
  truediv(value) {
    return this.expr().truediv(value);
  }
  __truediv__(value) {
    return this.truediv(value);
  }
  mod(value) {
    return this.expr().mod(value);
  }
  __mod__(value) {
    return this.mod(value);
  }
  __pow__(value) {
    return this.expr().__pow__(value);
  }
  __lshift__(value) {
    return this.expr().__lshift__(value);
  }
  __rshift__(value) {
    return this.expr().__rshift__(value);
  }
  __and__(value) {
    return this.expr().__and__(value);
  }
  __or__(value) {
    return this.expr().__or__(value);
  }
  __xor__(value) {
    return this.expr().__xor__(value);
  }
  isInteger() {
    return !0;
  }
  is_integer() {
    return !0;
  }
  isBoolean() {
    return this.model.isBooleanIndex(this.index);
  }
  get is_boolean() {
    return this.isBoolean();
  }
  negated() {
    if (!this.isBoolean())
      throw new TypeError("negated() is only supported for Boolean variables.");
    return new NotBoolVar(this);
  }
  toString() {
    let variable = this.model.proto().variables?.[this.index];
    if (variable?.name)
      return variable.name;
    let domain = variable?.domain ?? [];
    return domain.length >= 2 && protoInt64ToString(domain[0]) === protoInt64ToString(domain[1]) ? protoInt64ToString(domain[0]) : this.isBoolean() ? `b${this.index}` : `x${this.index}`;
  }
  [Symbol.toPrimitive](hint) {
    return hint === "string" ? this.toString() : unsupportedNativeOperatorCoercion();
  }
  debugString() {
    let name = String(this), domain = this.model.proto().variables?.[this.index]?.domain ?? [];
    return `${name}(${formatDomain(domain)})`;
  }
  repr() {
    return this.debugString();
  }
  eq(value) {
    return this.expr().eq(value);
  }
  ne(value) {
    return this.expr().ne(value);
  }
  le(value) {
    return this.expr().le(value);
  }
  lt(value) {
    return this.expr().lt(value);
  }
  __lt__(value) {
    return this.lt(value);
  }
  ge(value) {
    return this.expr().ge(value);
  }
  gt(value) {
    return this.expr().gt(value);
  }
  __gt__(value) {
    return this.gt(value);
  }
}, BoolVar = class extends IntVar {
  get literalIndex() {
    return this.index;
  }
  not() {
    return this.negated();
  }
};
function isBoolExpression(value) {
  return value instanceof BoolVar || value instanceof NotBoolVar;
}
var NotBoolVar = class {
  constructor(variable) {
    this.variable = variable;
    this.model = variable.model, this.index = -variable.index - 1, this.name = variable.name ? `not(${variable.name})` : "";
  }
  get model_proto() {
    return this.model.proto();
  }
  not() {
    return this.variable;
  }
  negated() {
    return this.variable;
  }
  plus(value, coeff = 1) {
    return this.expr().plus(value, coeff);
  }
  __add__(value) {
    return this.plus(value);
  }
  minus(value) {
    return this.expr().minus(value);
  }
  times(coeff) {
    return this.expr().times(coeff);
  }
  __mul__(coeff) {
    return this.times(coeff);
  }
  neg() {
    return this.expr().neg();
  }
  abs() {
    return this.expr().abs();
  }
  __abs__() {
    return this.abs();
  }
  div(value) {
    return this.expr().div(value);
  }
  __div__(value) {
    return this.div(value);
  }
  truediv(value) {
    return this.expr().truediv(value);
  }
  __truediv__(value) {
    return this.truediv(value);
  }
  mod(value) {
    return this.expr().mod(value);
  }
  __mod__(value) {
    return this.mod(value);
  }
  __pow__(value) {
    return this.expr().__pow__(value);
  }
  __lshift__(value) {
    return this.expr().__lshift__(value);
  }
  __rshift__(value) {
    return this.expr().__rshift__(value);
  }
  __and__(value) {
    return this.expr().__and__(value);
  }
  __or__(value) {
    return this.expr().__or__(value);
  }
  __xor__(value) {
    return this.expr().__xor__(value);
  }
  isInteger() {
    return !0;
  }
  is_integer() {
    return !0;
  }
  expr() {
    return new LinearExpr(this.model, /* @__PURE__ */ new Map([[this.variable.index, -1]]), 1, {
      kind: "not",
      index: this.variable.index
    });
  }
  toString() {
    return `not(${this.variable})`;
  }
  [Symbol.toPrimitive](hint) {
    return hint === "string" ? this.toString() : unsupportedNativeOperatorCoercion();
  }
  repr() {
    return `NotBooleanVariable(var_index=${this.variable.index})`;
  }
}, FlatIntExpr = class _FlatIntExpr {
  constructor(expression) {
    if (expression instanceof _FlatIntExpr || expression instanceof FlatFloatExpr) {
      valueError(expression.coeffs.every((coeff) => Number.isInteger(coeff)) && Number.isInteger(expression.offset), "expression is not integer"), this.vars = [...expression.vars], this.coeffs = [...expression.coeffs], this.offset = expression.offset;
      return;
    }
    let linear = LinearExpr.from(expression);
    valueError(linear.isInteger(), "expression is not integer");
    let vars = [], coeffs = [];
    for (let [index, coeff] of linear.terms)
      assert(linear.model, `missing model for variable ${index}`), vars.push(linear.model.getIntVarFromProtoIndex(index)), coeffs.push(coeff);
    this.vars = vars, this.coeffs = coeffs, this.offset = linear.offset;
  }
  expr() {
    let model = this.vars[0]?.model ?? null, terms = /* @__PURE__ */ new Map();
    for (let index = 0; index < this.vars.length; index += 1)
      terms.set(this.vars[index].index, this.coeffs[index]);
    return new LinearExpr(model, terms, this.offset);
  }
  plus(value) {
    return this.expr().plus(value);
  }
  minus(value) {
    return this.expr().minus(value);
  }
  times(coeff) {
    return this.expr().times(coeff);
  }
  toString() {
    return formatFlatExpression(this.vars, this.coeffs, this.offset);
  }
  repr() {
    return `FlatIntExpr([${this.vars.map((variable) => variable.repr()).join(", ")}], [${this.coeffs.join(", ")}], ${this.offset})`;
  }
}, FlatFloatExpr = class _FlatFloatExpr {
  constructor(expression) {
    if (expression instanceof FlatIntExpr || expression instanceof _FlatFloatExpr) {
      this.vars = [...expression.vars], this.coeffs = expression.coeffs.map((coeff) => Number(coeff)), this.offset = Number(expression.offset);
      return;
    }
    let linear = LinearExpr.from(expression), vars = [], coeffs = [];
    for (let [index, coeff] of linear.terms)
      assert(linear.model, `missing model for variable ${index}`), vars.push(linear.model.getIntVarFromProtoIndex(index)), coeffs.push(Number(coeff));
    this.vars = vars, this.coeffs = coeffs, this.offset = Number(linear.offset);
  }
  expr() {
    let model = this.vars[0]?.model ?? null, terms = /* @__PURE__ */ new Map();
    for (let index = 0; index < this.vars.length; index += 1)
      terms.set(this.vars[index].index, this.coeffs[index]);
    return new LinearExpr(model, terms, this.offset);
  }
  plus(value) {
    return this.expr().plus(value);
  }
  minus(value) {
    return this.expr().minus(value);
  }
  times(coeff) {
    return this.expr().times(coeff);
  }
  toString() {
    return formatFlatExpression(this.vars, this.coeffs, this.offset);
  }
  repr() {
    return `FlatFloatExpr([${this.vars.map((variable) => variable.repr()).join(", ")}], [${this.coeffs.join(", ")}], ${this.offset})`;
  }
}, IntervalVar = class {
  constructor(model, index, name = "", start, size, end, isPresent) {
    this.model = model;
    this.index = index;
    this.name = name;
    this.start = start;
    this.size = size;
    this.end = end;
    this.isPresent = isPresent;
  }
  get model_proto() {
    return this.model.proto();
  }
  startExpr() {
    return this.start;
  }
  sizeExpr() {
    return this.size;
  }
  endExpr() {
    return this.end;
  }
  presenceLiterals() {
    return this.isPresent === void 0 ? [] : [this.isPresent];
  }
  toString() {
    return this.name || `interval${this.index}`;
  }
  repr() {
    let pieces = [
      `start = ${this.start}`,
      `size = ${this.size}`,
      `end = ${this.end}`
    ];
    return this.isPresent !== void 0 && pieces.push(`is_present = ${this.isPresent}`), `${this}(${pieces.join(", ")})`;
  }
}, Constraint = class {
  constructor(model, index) {
    this.model = model;
    this.index = index;
  }
  get name() {
    return this.model.proto().constraints?.[this.index]?.name ?? "";
  }
  withName(name) {
    let constraint = this.model.proto().constraints?.[this.index];
    return assert(constraint, "constraint no longer exists in model"), constraint.name = name, this;
  }
  with_name(name) {
    return this.withName(name);
  }
  onlyEnforceIf(literals, ...rest) {
    let values = literalList(literals, rest), constraint = this.model.proto().constraints?.[this.index];
    return assert(constraint, "constraint no longer exists in model"), constraint.enforcementLiteral = [
      ...constraint.enforcementLiteral ?? [],
      ...this.model.literalReferences(values)
    ], this;
  }
};
function simplifyLinearSum(values) {
  let constant = 0, nonConstantValues = [];
  for (let value of values)
    typeof value == "number" ? constant += value : nonConstantValues.push(value);
  return nonConstantValues.length === 0 ? LinearExpr.constant(constant) : constant === 0 && nonConstantValues.length === 1 ? nonConstantValues[0] : null;
}
function combineLinearExpressions(values, scaleByIndex, display) {
  let model = null, terms = /* @__PURE__ */ new Map(), offset = 0, index = 0;
  for (let value of values) {
    let scale = scaleByIndex?.(index) ?? 1;
    assert(Number.isFinite(scale), `expected finite coefficient, got ${scale}`);
    let expression = LinearExpr.from(value);
    model && expression.model && requireSameModel(model, expression.model, "linear expression"), model ?? (model = expression.model);
    for (let [termIndex, termCoeff] of expression.terms)
      mergeTerms(terms, termIndex, termCoeff * scale);
    offset += expression.offset * scale, index += 1;
  }
  return new LinearExpr(model, terms, offset, display ?? null);
}
function sum(values, ...rest) {
  let valueList = iterableValues(values, rest), simplified = simplifyLinearSum(valueList);
  if (simplified !== null)
    return simplified;
  let displayValues = valueList.map((value) => LinearExpr.from(value).displayNodeForRendering());
  return combineLinearExpressions(valueList, void 0, { kind: "sum", values: displayValues });
}
function weightedSum(values, coeffs) {
  let valueList = Array.from(values), coeffList = Array.from(coeffs);
  valueError(valueList.length === coeffList.length, "weightedSum requires the same number of expressions and coefficients");
  let displayValues = valueList.map((value) => LinearExpr.from(value).displayNodeForRendering()), result = combineLinearExpressions(valueList, (index) => coeffList[index], {
    kind: "weighted",
    values: displayValues,
    coeffs: coeffList
  }), simplified = simplifyLinearSum([result]);
  return simplified !== null ? simplified : result;
}
function term(variable, coeff) {
  return variable.times(coeff);
}
function formatFlatExpression(vars, coeffs, offset) {
  let pieces = [];
  for (let index = 0; index < vars.length; index += 1) {
    let coeff = coeffs[index], variable = String(vars[index]);
    coeff === 1 ? pieces.push(variable) : coeff === -1 ? pieces.push(`-${variable}`) : pieces.push(`${coeff} * ${variable}`);
  }
  (offset !== 0 || pieces.length === 0) && pieces.push(String(offset));
  let [first, ...rest] = pieces, value = rest.reduce((text, piece) => piece.startsWith("-") ? `${text} - ${piece.slice(1)}` : `${text} + ${piece}`, first);
  return pieces.length > 1 ? `(${value})` : value;
}
function formatDomain(domain) {
  let pieces = [];
  for (let index = 0; index < domain.length; index += 2) {
    let lower = domain[index], upper = domain[index + 1];
    if (upper === void 0)
      break;
    let lowerText = protoInt64ToString(lower), upperText = protoInt64ToString(upper);
    pieces.push(lowerText === upperText ? lowerText : `${lowerText}..${upperText}`);
  }
  return pieces.join(", ");
}
function isBooleanDomain(domain) {
  return domain.length === 2 && compareProtoInt64(domain[0], 0) >= 0 && compareProtoInt64(domain[1], 1) <= 0;
}
var Domain = class _Domain {
  constructor(lowerOrIntervals, upper) {
    if (upper !== void 0) {
      this.flatIntervals = [normalizeInt64(lowerOrIntervals), normalizeInt64(upper)];
      return;
    }
    if (typeof lowerOrIntervals == "number" || typeof lowerOrIntervals == "string" || isProtoInt64Object(lowerOrIntervals)) {
      let value = normalizeInt64(lowerOrIntervals);
      this.flatIntervals = [value, value];
      return;
    }
    this.flatIntervals = Array.from(lowerOrIntervals, normalizeInt64);
  }
  static fromFlatIntervals(intervals) {
    return new _Domain(Array.from(intervals, normalizeInt64));
  }
  static from_flat_intervals(intervals) {
    return _Domain.fromFlatIntervals(intervals);
  }
  static fromIntervals(intervals) {
    let flatIntervals = [];
    for (let interval of intervals) {
      let values = Array.from(interval, normalizeInt64);
      valueError(values.length === 1 || values.length === 2, "domain intervals must contain one or two bounds"), flatIntervals.push(values[0], values[1] ?? values[0]);
    }
    return new _Domain(flatIntervals);
  }
  static from_intervals(intervals) {
    return _Domain.fromIntervals(intervals);
  }
  static fromValues(values) {
    let sortedValues = Array.from(new Set(values)).sort((left, right) => left - right), flatIntervals = [];
    for (let value of sortedValues) {
      valueError(Number.isInteger(value), `domain value must be an integer, got ${value}`);
      let lastUpper = flatIntervals[flatIntervals.length - 1];
      typeof lastUpper == "number" && lastUpper + 1 === value ? flatIntervals[flatIntervals.length - 1] = value : flatIntervals.push(value, value);
    }
    return new _Domain(flatIntervals);
  }
  static from_values(values) {
    return _Domain.fromValues(values);
  }
}, CpModel = class _CpModel {
  constructor(model) {
    this.boolVariableIndexes = /* @__PURE__ */ new Set();
    this.constantIndexes = /* @__PURE__ */ new Map();
    this.intVariables = /* @__PURE__ */ new Map();
    this.trueConstant = null;
    this.falseConstant = null;
    this.model = model === void 0 ? { variables: [], constraints: [] } : cloneProto(model);
    for (let [index, variable] of (this.model.variables ?? []).entries()) {
      let domain = variable.domain ?? [];
      isBooleanDomain(domain) && this.boolVariableIndexes.add(index), domain.length === 2 && compareProtoInt64(domain[0], domain[1]) === 0 && this.constantIndexes.set(protoInt64ToNumber(domain[0]), index);
    }
  }
  get name() {
    return this.model.name ?? "";
  }
  set name(name) {
    this.model.name = name;
  }
  proto() {
    return this.model;
  }
  Proto() {
    return this.proto();
  }
  clone() {
    return new _CpModel(this.model);
  }
  removeAllNames() {
    this.model.name = "";
    for (let variable of this.model.variables ?? [])
      variable.name = "";
    for (let constraint of this.model.constraints ?? [])
      constraint.name = "";
  }
  remove_all_names() {
    this.removeAllNames();
  }
  newIntVar(lb, ub, name = "") {
    let index = this.model.variables?.length ?? 0, domain = [normalizeInt64(lb), normalizeInt64(ub)];
    this.model.variables?.push(compareProtoInt64(lb, ub) <= 0 ? { name, domain } : { name }), isBooleanDomain(domain) && this.boolVariableIndexes.add(index);
    let variable = new IntVar(this, index, name);
    return this.intVariables.set(index, variable), variable;
  }
  new_int_var(lb, ub, name = "") {
    return this.newIntVar(lb, ub, name);
  }
  NewIntVar(lb, ub, name = "") {
    return this.newIntVar(lb, ub, name);
  }
  newIntVarFromDomain(domain, name = "") {
    let index = this.model.variables?.length ?? 0, flatDomain = [...domain.flatIntervals];
    this.model.variables?.push({ name, domain: flatDomain }), isBooleanDomain(flatDomain) && this.boolVariableIndexes.add(index);
    let variable = new IntVar(this, index, name);
    return this.intVariables.set(index, variable), variable;
  }
  new_int_var_from_domain(domain, name = "") {
    return this.newIntVarFromDomain(domain, name);
  }
  NewIntVarFromDomain(domain, name = "") {
    return this.newIntVarFromDomain(domain, name);
  }
  newBoolVar(name = "") {
    let index = this.model.variables?.length ?? 0;
    this.model.variables?.push({ name, domain: [0, 1] }), this.boolVariableIndexes.add(index);
    let variable = new BoolVar(this, index, name);
    return this.intVariables.set(index, variable), variable;
  }
  new_bool_var(name = "") {
    return this.newBoolVar(name);
  }
  NewBoolVar(name = "") {
    return this.newBoolVar(name);
  }
  newConstant(value, name = "") {
    return name ? this.newIntVar(value, value, name) : this.getIntVarFromProtoIndex(this.getOrMakeIndexFromConstant(value));
  }
  new_constant(value, name = "") {
    return this.newConstant(value, name);
  }
  NewConstant(value, name = "") {
    return this.newConstant(value, name);
  }
  getIntVarFromProtoIndex(index) {
    valueError(Number.isInteger(index), `variable index must be an integer, got ${index}`);
    let variables = this.model.variables ?? [];
    valueError(index >= 0 && index < variables.length, `getIntVarFromProtoIndex: out of bound index ${index}`);
    let existing = this.intVariables.get(index);
    if (existing !== void 0)
      return existing;
    let variable = new IntVar(this, index, variables[index]?.name ?? "");
    return this.intVariables.set(index, variable), variable;
  }
  get_int_var_from_proto_index(index) {
    return this.getIntVarFromProtoIndex(index);
  }
  getBoolVarFromProtoIndex(index) {
    let variable = this.getIntVarFromProtoIndex(index);
    if (!variable.isBoolean())
      throw new TypeError(`getBoolVarFromProtoIndex: index ${index} is not Boolean`);
    if (variable instanceof BoolVar)
      return variable;
    let boolVariable = new BoolVar(this, index);
    return this.intVariables.set(index, boolVariable), boolVariable;
  }
  get_bool_var_from_proto_index(index) {
    return this.getBoolVarFromProtoIndex(index);
  }
  getIntervalVarFromProtoIndex(index) {
    valueError(Number.isInteger(index), `interval index must be an integer, got ${index}`);
    let constraints = this.model.constraints ?? [];
    valueError(index >= 0 && index < constraints.length, `getIntervalVarFromProtoIndex: out of bound index ${index}`);
    let constraint = constraints[index];
    valueError(constraint?.interval !== void 0, `getIntervalVarFromProtoIndex: index ${index} is not an interval`);
    let interval = constraint.interval;
    return new IntervalVar(
      this,
      index,
      constraint.name ?? "",
      this.expressionFromProto(interval.start),
      this.expressionFromProto(interval.size),
      this.expressionFromProto(interval.end),
      constraint.enforcementLiteral?.[0] === void 0 ? void 0 : this.literalFromProtoIndex(constraint.enforcementLiteral[0])
    );
  }
  get_interval_var_from_proto_index(index) {
    return this.getIntervalVarFromProtoIndex(index);
  }
  getOrMakeIndexFromConstant(value) {
    valueError(Number.isInteger(value), `constant index requires an integer, got ${value}`);
    let existingIndex = this.constantIndexes.get(value);
    if (existingIndex !== void 0)
      return existingIndex;
    let index = this.model.variables?.length ?? 0, domain = [value, value];
    return this.model.variables?.push({ domain }), isBooleanDomain(domain) && this.boolVariableIndexes.add(index), this.constantIndexes.set(value, index), index;
  }
  get_or_make_index_from_constant(value) {
    return this.getOrMakeIndexFromConstant(value);
  }
  getOrMakeVariableIndex(variable) {
    return this.get_or_make_variable_index(variable);
  }
  isBooleanValue(value) {
    return value === !0 || value === !1;
  }
  is_boolean_value(value) {
    return this.isBooleanValue(value);
  }
  isBooleanIndex(index) {
    return this.boolVariableIndexes.has(index);
  }
  get_or_make_variable_index(variable) {
    if (typeof variable == "number")
      return valueError(Number.isInteger(variable), `variable index requires an integer, got ${variable}`), this.getOrMakeIndexFromConstant(variable);
    if (variable instanceof IntVar)
      return requireSameModel(this, variable.model, "variable"), variable.index;
    if (variable instanceof NotBoolVar)
      return requireSameModel(this, variable.model, "variable"), variable.index;
    if (variable === !0)
      return this.constantBoolIndex(!0);
    if (variable === !1)
      return this.constantBoolIndex(!1);
    throw new TypeError("expected a variable-like object");
  }
  add(bound) {
    return bound === !0 ? this.addBoolOr([!0]) : bound === !1 ? this.addBoolOr([]) : this.addLinearConstraint(bound.expression, bound.lowerBound, bound.upperBound, bound.domain);
  }
  Add(bound) {
    return this.add(bound);
  }
  addLinearConstraint(expression, lb, ub, domain) {
    let expr = LinearExpr.from(expression);
    if (this.checkExpressionModel(expr), expr.terms.size === 0 && domain === void 0) {
      let numericLb = protoInt64ToNumber(lb), numericUb = protoInt64ToNumber(ub);
      return expr.offset >= numericLb && expr.offset <= numericUb ? this.pushConstraint({ boolAnd: { literals: [] } }) : this.pushConstraint({ boolOr: { literals: [] } });
    }
    let proto = expr.toProto(), adjustedDomain = (domain ?? [lb, ub]).map((value) => adjustDomainEndpoint(value, expr.offset));
    return this.pushConstraint({
      linear: {
        vars: proto.vars,
        coeffs: proto.coeffs,
        domain: adjustedDomain
      }
    });
  }
  add_linear_constraint(expression, lb, ub) {
    return this.addLinearConstraint(expression, lb, ub);
  }
  AddLinearConstraint(expression, lb, ub) {
    return this.addLinearConstraint(expression, lb, ub);
  }
  addEquality(left, right) {
    return this.add(LinearExpr.from(left).eq(right));
  }
  addAllDifferent(expressions, ...rest) {
    return this.pushConstraint({
      allDiff: { exprs: this.expressionProtos(expressionList(expressions, rest)) }
    });
  }
  AddAllDifferent(expressions, ...rest) {
    return this.addAllDifferent(expressions, ...rest);
  }
  addElement(index, expressions, target) {
    let exprs = Array.from(expressions);
    return valueError(exprs.length > 0, "addElement requires at least one expression"), typeof index == "number" ? (valueError(Number.isInteger(index), `element index must be an integer, got ${index}`), valueError(index >= 0 && index < exprs.length, `element index ${index} is out of range`), this.add(LinearExpr.from(target).eq(exprs[index]))) : this.pushConstraint({
      element: {
        linearIndex: this.expressionProto(index),
        exprs: this.expressionProtos(exprs),
        linearTarget: this.expressionProto(target)
      }
    });
  }
  addAllowedAssignments(expressions, tuples) {
    let exprs = this.expressionProtos(expressions);
    valueError(exprs.length > 0, "addAllowedAssignments requires at least one expression");
    let values = Array.from(tuples, (tupleValue) => Array.from(tupleValue));
    for (let tupleValue of values)
      valueError(tupleValue.length === exprs.length, "tuple arity does not match expression count");
    return this.pushConstraint({
      table: {
        exprs,
        values: values.flat().map(asInt64)
      }
    });
  }
  addForbiddenAssignments(expressions, tuples) {
    let constraint = this.addAllowedAssignments(expressions, tuples), proto = this.model.constraints?.[constraint.index];
    return assert(proto?.table, "table constraint was not created"), proto.table.negated = !0, constraint;
  }
  addAutomaton(expressions, startingState, finalStates, transitions) {
    let exprs = this.expressionProtos(expressions), finalStateValues = Array.from(finalStates, asInt64), transitionValues = Array.from(transitions);
    valueError(exprs.length > 0, "addAutomaton requires at least one expression"), valueError(finalStateValues.length > 0, "addAutomaton requires at least one final state"), valueError(transitionValues.length > 0, "addAutomaton requires at least one transition");
    let tails = [], labels = [], heads = [];
    for (let transition of transitionValues) {
      valueError(transition.length === 3, "automaton transitions must contain tail, label, and head");
      let [tail, label, head] = transition;
      tails.push(asInt64(tail)), labels.push(asInt64(label)), heads.push(asInt64(head));
    }
    return this.pushConstraint({
      automaton: {
        exprs,
        startingState: asInt64(startingState),
        finalStates: finalStateValues,
        transitionTail: tails,
        transitionLabel: labels,
        transitionHead: heads
      }
    });
  }
  addCircuit(arcs) {
    let arcValues = Array.from(arcs);
    valueError(arcValues.length > 0, "addCircuit requires at least one arc");
    let tails = [], heads = [], literals = [];
    for (let [tail, head, literal] of arcValues) {
      let [literalRef] = this.literalReferences([literal]);
      tails.push(tail), heads.push(head), literals.push(literalRef);
    }
    return this.pushConstraint({ circuit: { tails, heads, literals } });
  }
  addMultipleCircuit(arcs) {
    let arcValues = Array.from(arcs);
    valueError(arcValues.length > 0, "addMultipleCircuit requires at least one arc");
    let tails = [], heads = [], literals = [];
    for (let [tail, head, literal] of arcValues) {
      let [literalRef] = this.literalReferences([literal]);
      tails.push(tail), heads.push(head), literals.push(literalRef);
    }
    return this.pushConstraint({ routes: { tails, heads, literals } });
  }
  addInverse(direct, inverse) {
    return this.pushConstraint({
      inverse: {
        fDirect: this.variableIndexes(direct),
        fInverse: this.variableIndexes(inverse)
      }
    });
  }
  addMaxEquality(target, expressions, ...rest) {
    return this.pushConstraint({
      linMax: {
        target: this.expressionProto(target),
        exprs: this.expressionProtos(expressionList(expressions, rest))
      }
    });
  }
  add_max_equality(target, expressions, ...rest) {
    return this.addMaxEquality(target, expressions, ...rest);
  }
  addMinEquality(target, expressions, ...rest) {
    let values = expressionList(expressions, rest);
    return this.pushConstraint({
      linMax: {
        target: LinearExpr.from(target).neg().toProto(),
        exprs: values.map((expression) => LinearExpr.from(expression).neg().toProto())
      }
    });
  }
  add_min_equality(target, expressions, ...rest) {
    return this.addMinEquality(target, expressions, ...rest);
  }
  addAbsEquality(target, expression) {
    let expr = LinearExpr.from(expression);
    return this.addMaxEquality(target, [expr, expr.neg()]);
  }
  add_abs_equality(target, expression) {
    return this.addAbsEquality(target, expression);
  }
  addDivisionEquality(target, numerator, denominator) {
    return this.pushConstraint({
      intDiv: {
        target: this.expressionProto(target),
        exprs: [this.expressionProto(numerator), this.expressionProto(denominator)]
      }
    });
  }
  add_division_equality(target, numerator, denominator) {
    return this.addDivisionEquality(target, numerator, denominator);
  }
  addModuloEquality(target, expression, modulo2) {
    return this.pushConstraint({
      intMod: {
        target: this.expressionProto(target),
        exprs: [this.expressionProto(expression), this.expressionProto(modulo2)]
      }
    });
  }
  add_modulo_equality(target, expression, modulo2) {
    return this.addModuloEquality(target, expression, modulo2);
  }
  addMultiplicationEquality(target, expressions, ...rest) {
    return this.pushConstraint({
      intProd: {
        target: this.expressionProto(target),
        exprs: this.expressionProtos(expressionList(expressions, rest))
      }
    });
  }
  add_multiplication_equality(target, expressions, ...rest) {
    return this.addMultiplicationEquality(target, expressions, ...rest);
  }
  addImplication(left, right) {
    return this.pushConstraint({
      enforcementLiteral: this.literalReferences([left]),
      boolAnd: { literals: this.literalReferences([right]) }
    });
  }
  add_implication(left, right) {
    return this.addImplication(left, right);
  }
  addBoolOr(literals, ...rest) {
    return this.pushConstraint({ boolOr: { literals: this.literalReferences(literalList(literals, rest)) } });
  }
  add_bool_or(literals, ...rest) {
    return this.addBoolOr(literals, ...rest);
  }
  AddBoolOr(literals, ...rest) {
    return this.addBoolOr(literals, ...rest);
  }
  addAtLeastOne(literals, ...rest) {
    return this.addBoolOr(literals, ...rest);
  }
  add_at_least_one(literals, ...rest) {
    return this.addAtLeastOne(literals, ...rest);
  }
  addBoolAnd(literals) {
    return this.pushConstraint({ boolAnd: { literals: this.literalReferences(literals) } });
  }
  add_bool_and(literals) {
    return this.addBoolAnd(literals);
  }
  AddBoolAnd(literals) {
    return this.addBoolAnd(literals);
  }
  addBoolXor(literals) {
    return this.pushConstraint({ boolXor: { literals: this.literalReferences(literals) } });
  }
  add_bool_xor(literals) {
    return this.addBoolXor(literals);
  }
  AddBoolXOr(literals) {
    return this.addBoolXor(literals);
  }
  addAtMostOne(literals) {
    return this.pushConstraint({ atMostOne: { literals: this.literalReferences(literals) } });
  }
  add_at_most_one(literals) {
    return this.addAtMostOne(literals);
  }
  addExactlyOne(literals) {
    return this.pushConstraint({ exactlyOne: { literals: this.literalReferences(literals) } });
  }
  add_exactly_one(literals) {
    return this.addExactlyOne(literals);
  }
  addMapDomain(variable, booleanVariables, offset = 0) {
    requireSameModel(this, variable.model, "map domain variable");
    for (let [index, literal] of Array.from(booleanVariables).entries()) {
      requireSameModel(this, literal.model, "map domain literal");
      let value = offset + index;
      this.pushConstraint({
        enforcementLiteral: [literal.index],
        linear: {
          vars: [variable.index],
          coeffs: [1],
          domain: [asInt64(value), asInt64(value)]
        }
      }), this.pushConstraint({
        enforcementLiteral: [literal.negated().index],
        linear: {
          vars: [variable.index],
          coeffs: [1],
          domain: [INT64_MIN, asInt64(value - 1), asInt64(value + 1), INT64_MAX]
        }
      });
    }
  }
  add_map_domain(variable, booleanVariables, offset = 0) {
    return this.addMapDomain(variable, booleanVariables, offset);
  }
  newIntervalVar(start, size, end, name = "") {
    return this.pushInterval({ start, size, end, name });
  }
  new_interval_var(start, size, end, name = "") {
    return this.newIntervalVar(start, size, end, name);
  }
  newFixedSizeIntervalVar(start, size, name = "") {
    return this.pushInterval({ start, size, end: LinearExpr.from(start).plus(size), name });
  }
  new_fixed_size_interval_var(start, size, name = "") {
    return this.newFixedSizeIntervalVar(start, size, name);
  }
  newOptionalFixedSizeIntervalVar(start, size, isPresent, name = "") {
    return this.newOptionalIntervalVar(start, size, LinearExpr.from(start).plus(size), isPresent, name);
  }
  new_optional_fixed_size_interval_var(start, size, isPresent, name = "") {
    return this.newOptionalFixedSizeIntervalVar(start, size, isPresent, name);
  }
  newOptionalIntervalVar(start, size, end, isPresent, name = "") {
    if (!(isPresent instanceof BoolVar || isPresent instanceof NotBoolVar || typeof isPresent == "boolean" || isPresent === 0 || isPresent === 1))
      throw new TypeError("optional interval presence literal must be Boolean");
    if (this.hasBooleanExpressionTerm(start) || this.hasBooleanExpressionTerm(size) || this.hasBooleanExpressionTerm(end))
      throw new TypeError("optional interval start, size, and end must be integer expressions");
    return this.pushInterval({ start, size, end, isPresent, name });
  }
  new_optional_interval_var(start, size, end, isPresent, name = "") {
    return this.newOptionalIntervalVar(start, size, end, isPresent, name);
  }
  addNoOverlap(intervals) {
    return this.pushConstraint({ noOverlap: { intervals: this.intervalIndexes(intervals) } });
  }
  add_no_overlap(intervals) {
    return this.addNoOverlap(intervals);
  }
  AddNoOverlap(intervals) {
    return this.addNoOverlap(intervals);
  }
  addNoOverlap2D(xIntervals, yIntervals) {
    return this.pushConstraint({
      noOverlap2d: {
        xIntervals: this.intervalIndexes(xIntervals),
        yIntervals: this.intervalIndexes(yIntervals)
      }
    });
  }
  add_no_overlap_2d(xIntervals, yIntervals) {
    return this.addNoOverlap2D(xIntervals, yIntervals);
  }
  AddNoOverlap2D(xIntervals, yIntervals) {
    return this.addNoOverlap2D(xIntervals, yIntervals);
  }
  addCumulative(intervals, demands, capacity) {
    return this.pushConstraint({
      cumulative: {
        intervals: this.intervalIndexes(intervals),
        demands: this.expressionProtos(demands),
        capacity: this.expressionProto(capacity)
      }
    });
  }
  add_cumulative(intervals, demands, capacity) {
    return this.addCumulative(intervals, demands, capacity);
  }
  addReservoirConstraint(times, levelChanges, minLevel, maxLevel, activeLiterals) {
    return this.pushConstraint({
      reservoir: {
        timeExprs: this.expressionProtos(times),
        levelChanges: this.expressionProtos(levelChanges),
        minLevel: asInt64(minLevel),
        maxLevel: asInt64(maxLevel),
        activeLiterals: activeLiterals ? this.literalReferences(activeLiterals) : void 0
      }
    });
  }
  addDecisionStrategy(expressions, variableSelectionStrategy, domainReductionStrategy) {
    var _a;
    (_a = this.model).searchStrategy ?? (_a.searchStrategy = []), this.model.searchStrategy.push({
      exprs: this.expressionProtos(expressions),
      variableSelectionStrategy,
      domainReductionStrategy
    });
  }
  addHint(variable, value) {
    var _a;
    let hintedValue = typeof value == "boolean" ? value ? 1 : 0 : value, hintVariable = variable instanceof NotBoolVar ? variable.variable : variable, hintValue = variable instanceof NotBoolVar ? 1 - hintedValue : hintedValue;
    requireSameModel(this, hintVariable.model, "hint variable"), (_a = this.model).solutionHint ?? (_a.solutionHint = { vars: [], values: [] }), this.model.solutionHint.vars?.push(hintVariable.index), this.model.solutionHint.values?.push(asInt64(hintValue));
  }
  addAssumption(literal) {
    var _a;
    (_a = this.model).assumptions ?? (_a.assumptions = []);
    let index = literalIndex(literal);
    assert(typeof index == "number", "assumptions require variable literals"), this.model.assumptions.push(index);
  }
  addAssumptions(literals) {
    for (let literal of literals)
      this.addAssumption(literal);
  }
  clearAssumptions() {
    this.model.assumptions = [];
  }
  minimize(expression) {
    let expr = LinearExpr.from(expression);
    if (this.checkExpressionModel(expr), expr.hasFloatingPointTerms()) {
      this.model.objective = void 0, this.model.floatingPointObjective = expr.toFloatObjective(!1);
      return;
    }
    let proto = expr.toProto();
    this.model.floatingPointObjective = void 0, this.model.objective = {
      vars: proto.vars,
      coeffs: proto.coeffs,
      offset: typeof proto.offset == "number" ? proto.offset : void 0
    };
  }
  Minimize(expression) {
    return this.minimize(expression);
  }
  maximize(expression) {
    let originalExpr = LinearExpr.from(expression);
    if (this.checkExpressionModel(originalExpr), originalExpr.hasFloatingPointTerms()) {
      this.model.objective = void 0, this.model.floatingPointObjective = originalExpr.toFloatObjective(!0);
      return;
    }
    let expr = originalExpr.neg();
    this.checkExpressionModel(expr);
    let proto = expr.toProto();
    this.model.floatingPointObjective = void 0, this.model.objective = {
      vars: proto.vars,
      coeffs: proto.coeffs,
      offset: typeof proto.offset == "number" ? proto.offset : void 0,
      scalingFactor: -1
    };
  }
  Maximize(expression) {
    return this.maximize(expression);
  }
  hasObjective() {
    return this.model.objective !== void 0 || this.model.floatingPointObjective !== void 0;
  }
  modelStats() {
    return JSON.stringify({
      variables: this.model.variables?.length ?? 0,
      constraints: this.model.constraints?.length ?? 0,
      hasObjective: this.hasObjective()
    });
  }
  async validate() {
    let modelBytes = await CpSat.createModel(this.proto()), validation = await CpSat.validate(modelBytes);
    return validation.ok ? "" : validation.message;
  }
  pushInterval(input) {
    let constraint = {
      name: input.name,
      interval: {
        start: this.expressionProto(input.start),
        size: this.expressionProto(input.size),
        end: this.expressionProto(input.end)
      }
    };
    input.isPresent !== void 0 && (constraint.enforcementLiteral = this.literalReferences([input.isPresent]));
    let index = this.model.constraints?.length ?? 0;
    return this.model.constraints?.push(constraint), new IntervalVar(this, index, input.name, input.start, input.size, input.end, input.isPresent);
  }
  pushConstraint(constraint) {
    let index = this.model.constraints?.length ?? 0;
    return this.model.constraints?.push(constraint), new Constraint(this, index);
  }
  checkExpressionModel(expression) {
    expression.model && requireSameModel(this, expression.model, "linear expression");
  }
  expressionProto(expression) {
    let expr = LinearExpr.from(expression);
    return this.checkExpressionModel(expr), expr.toProto();
  }
  expressionFromProto(proto) {
    if (proto === void 0)
      return 0;
    let terms = /* @__PURE__ */ new Map(), vars = proto.vars ?? [], coeffs = proto.coeffs ?? [];
    for (let index = 0; index < vars.length; index += 1)
      mergeTerms(terms, vars[index], protoInt64ToNumber(coeffs[index]));
    return new LinearExpr(this, terms, protoInt64ToNumber(proto.offset));
  }
  literalFromProtoIndex(index) {
    return index >= 0 ? this.getBoolVarFromProtoIndex(index) : this.getBoolVarFromProtoIndex(-index - 1).negated();
  }
  expressionProtos(expressions) {
    return Array.from(expressions, (expression) => this.expressionProto(expression));
  }
  variableIndexes(variables) {
    return Array.from(variables, (variable) => (requireSameModel(this, variable.model, "variable"), variable.index));
  }
  intervalIndexes(intervals) {
    return Array.from(intervals, (interval) => {
      if (!(interval instanceof IntervalVar))
        throw new TypeError("expected interval variable");
      return requireSameModel(this, interval.model, "interval"), interval.index;
    });
  }
  hasBooleanExpressionTerm(expression) {
    if (isBoolExpression(expression))
      return !0;
    let expr = LinearExpr.from(expression);
    return this.checkExpressionModel(expr), Array.from(expr.terms.keys()).some((index) => this.boolVariableIndexes.has(index));
  }
  literalReferences(literals) {
    return Array.from(literals, (literal) => {
      let index = literalIndex(literal);
      return index === !0 ? this.constantBoolIndex(!0) : index === !1 ? this.constantBoolIndex(!1) : (assert(literal instanceof BoolVar || literal instanceof NotBoolVar, "literal must be a Boolean variable or its negation"), requireSameModel(this, literal.model, "literal"), index);
    });
  }
  constantBoolIndex(value) {
    return value ? (this.trueConstant ?? (this.trueConstant = this.getBoolVarFromProtoIndex(this.getOrMakeIndexFromConstant(1))), this.trueConstant.index) : (this.falseConstant ?? (this.falseConstant = this.getBoolVarFromProtoIndex(this.getOrMakeIndexFromConstant(0))), this.falseConstant.index);
  }
}, CpSolverSolutionCallback = class {
  constructor() {
    this.currentResponse = null;
  }
  onSolutionCallback() {
  }
  value(expression) {
    return evaluateLinearExpression(this.requireCurrentResponse(), expression);
  }
  floatValue(expression) {
    return evaluateLinearExpression(this.requireCurrentResponse(), expression);
  }
  booleanValue(literal) {
    return evaluateBooleanLiteral(this.requireCurrentResponse(), literal);
  }
  get objectiveValue() {
    let response = this.requireCurrentResponse();
    return runtimeError(typeof response.objectiveValue == "number", "missing objective value"), response.objectiveValue;
  }
  get bestObjectiveBound() {
    let response = this.requireCurrentResponse();
    return runtimeError(typeof response.bestObjectiveBound == "number", "missing best objective bound"), response.bestObjectiveBound;
  }
  get wallTime() {
    return this.requireCurrentResponse().wallTime ?? 0;
  }
  _run(response) {
    this.currentResponse = response;
    try {
      this.onSolutionCallback();
    } finally {
      this.currentResponse = null;
    }
  }
  requireCurrentResponse() {
    if (!this.currentResponse)
      throw new RuntimeError("solve() has not started or the callback is not currently running");
    return this.currentResponse;
  }
}, CpSolver = class {
  constructor() {
    this.lastResponse = null;
    this.solving = !1;
    this.parameters = {};
    this.bestBoundCallback = null;
    this.logCallback = null;
  }
  async solve(model, options = {}) {
    if (this.solving)
      throw new RuntimeError("CpSolver.solve() is already in progress.");
    this.solving = !0;
    try {
      return await this.solveOnce(model, options);
    } finally {
      this.solving = !1;
    }
  }
  async solveOnce(model, options) {
    let {
      executor,
      solutionCallback = null,
      onEvent,
      eventMask: requestedEventMask,
      signal,
      ...solverParameters
    } = options, mergedParams = { ...this.parameters, ...solverParameters }, modelBytes = await CpSat.createModel(model.proto()), hasInternalEvents = !!(solutionCallback || this.bestBoundCallback || this.logCallback), eventMask = requestedEventMask;
    hasInternalEvents && (eventMask || !onEvent) && (eventMask = {
      solution: !!solutionCallback || !!eventMask?.solution,
      bestBound: !!this.bestBoundCallback || !!eventMask?.bestBound,
      log: !!this.logCallback || !!eventMask?.log
    });
    let result = await CpSat.solve(modelBytes, {
      ...mergedParams,
      executor,
      signal,
      eventMask,
      onEvent: hasInternalEvents || onEvent ? async (event) => {
        event.type === "solution" ? solutionCallback?._run(event.response) : event.type === "bestBound" ? this.bestBoundCallback?.(event.bound) : event.type === "log" && this.logCallback?.(event.message), await onEvent?.(event);
      } : void 0
    });
    return this.lastResponse = result.response, result.response?.status;
  }
  response() {
    return this.lastResponse;
  }
  responseStats() {
    return JSON.stringify(this.requireResponse());
  }
  get best_objective_bound() {
    return this.bestObjectiveBound();
  }
  get deterministic_time() {
    let response = this.requireResponse();
    return runtimeError(typeof response.deterministicTime == "number", "missing deterministic time"), response.deterministicTime;
  }
  get num_binary_propagations() {
    return protoInt64ToNumber(this.requireResponse().numBinaryPropagations);
  }
  get num_integer_propagations() {
    return protoInt64ToNumber(this.requireResponse().numIntegerPropagations);
  }
  get user_time() {
    let response = this.requireResponse();
    return runtimeError(typeof response.userTime == "number", "missing user time"), response.userTime;
  }
  get response_proto() {
    return this.requireResponse();
  }
  get solve_log() {
    return this.requireResponse().solveLog;
  }
  get num_booleans() {
    return this.numBooleans;
  }
  get num_conflicts() {
    return this.numConflicts;
  }
  get num_branches() {
    return this.numBranches;
  }
  get num_integers() {
    return protoInt64ToNumber(this.requireResponse().numIntegers);
  }
  get wall_time() {
    return this.wallTime;
  }
  get objective_value() {
    return this.objectiveValue();
  }
  set best_bound_callback(callback) {
    this.bestBoundCallback = callback;
  }
  set log_callback(callback) {
    this.logCallback = callback;
  }
  solutionInfo() {
    return this.requireResponse().solutionInfo ?? "";
  }
  get numBooleans() {
    return protoInt64ToNumber(this.requireResponse().numBooleans);
  }
  get numConflicts() {
    return protoInt64ToNumber(this.requireResponse().numConflicts);
  }
  get numBranches() {
    return protoInt64ToNumber(this.requireResponse().numBranches);
  }
  get wallTime() {
    return this.requireResponse().wallTime ?? 0;
  }
  value(expression) {
    return evaluateLinearExpression(this.requireResponse(), expression);
  }
  floatValue(expression) {
    return this.value(expression);
  }
  booleanValue(literal) {
    return evaluateBooleanLiteral(this.requireResponse(), literal);
  }
  objectiveValue() {
    let response = this.requireResponse();
    return runtimeError(typeof response.objectiveValue == "number", "missing objective value"), response.objectiveValue;
  }
  bestObjectiveBound() {
    let response = this.requireResponse();
    return runtimeError(typeof response.bestObjectiveBound == "number", "missing best objective bound"), response.bestObjectiveBound;
  }
  statusName(status = this.lastResponse?.status) {
    return typeof status == "string" ? status : CpSolverStatus[status] ?? String(status);
  }
  requireResponse() {
    return runtimeError(this.lastResponse !== null, "solve() has not completed with a solver response"), this.lastResponse;
  }
  get best_bound_callback() {
    return this.bestBoundCallback;
  }
  get log_callback() {
    return this.logCallback;
  }
};
export {
  ArithmeticError,
  BoolVar,
  BoundedLinearExpr,
  BoundedLinearExpression,
  CloudExecutorUnavailableError,
  Constraint,
  CpModel,
  CpSat,
  CpSolver,
  CpSolverSolutionCallback,
  CpSolverStatus,
  DecisionStrategyProto_DomainReductionStrategy,
  DecisionStrategyProto_VariableSelectionStrategy,
  Domain,
  FlatFloatExpr,
  FlatIntExpr,
  IntVar,
  IntervalVar,
  LinearExpr,
  NotBoolVar,
  NotImplementedError,
  RuntimeError,
  ValueError,
  api_default as default,
  objectIsAFalseLiteral,
  objectIsATrueLiteral,
  object_is_a_false_literal,
  object_is_a_true_literal,
  rebuildFromLinearExpressionProto,
  rebuild_from_linear_expression_proto,
  sum,
  term,
  terminateLoadedRuntimeThreads2 as terminateLoadedRuntimeThreads,
  weightedSum
};
/*! Bundled license information:

long/umd/index.js:
long/index.js:
  (**
   * @license
   * Copyright 2009 The Closure Library Authors
   * Copyright 2020 Daniel Wirtz / The long.js Authors.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *
   * SPDX-License-Identifier: Apache-2.0
   *)
*/
