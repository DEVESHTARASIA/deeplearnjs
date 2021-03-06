/**
 * @license
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import * as axis_util from './axis_util';
import * as binary_ops from './binary_ops';
import {operation} from './decorators';
import {NDArray, Scalar} from './ndarray';
import * as reduction_ops from './reduction_ops';
import {DataType, SumTypes} from './types';
import * as unary_ops from './unary_ops';

export class Ops {
  /**
   * Computes the norm of scalar, vectors, and matrices.
   * This function can compute several different vector norms (the 1-norm, the
   * Euclidean or 2-norm, the inf-norm, and in general the p-norm for p > 0)
   * and matrix norms (Frobenius, 1-norm, and inf-norm).
   *
   * @param x The input array.
   * @param ord Optional. Order of the norm. Supported norm types are
   * following: ord         norm for matrices          norm for vectors
   *     -------------------------------------------------------
   *     'euclidean' Frobenius norm             2-norm
   *     ‘fro’       Frobenius norm	            –
   *     Infinity    max(sum(abs(x), axis=1))   max(abs(x))
   *     -Infinity   min(sum(abs(x), axis=1))   min(abs(x))
   *     1           max(sum(abs(x), axis=0))   sum(abs(x))
   *     2           -                          sum(abs(x)^2)^1/2*
   *
   * @param axis Optional. If axis is null (the default), the input is
   * considered a vector and a single vector norm is computed over the entire
   * set of values in the NDArray, i.e. norm(x, ord) is equivalent
   * to norm(x.reshape([-1]), ord). If axis is a integer, the input
   * is considered a batch of vectors, and axis determines the axis in x
   * over which to compute vector norms. If axis is a 2-tuple of integer it is
   * considered a batch of matrices and axis determines the axes in NDArray
   * over which to compute a matrix norm.
   * @param keepDims Optional. If true, the norm have the same dimensionality
   * as the input.
   */
  @operation
  static norm<D extends DataType>(
      x: NDArray<D>, ord: number|'euclidean'|'fro' = 'euclidean',
      axis: number|number[] = null, keepDims = false): NDArray<D|SumTypes[D]> {
    const norm = normInternal(x, ord, axis);
    let keepDimsShape = norm.shape;
    if (keepDims) {
      const axes = axis_util.parseAxisParam(axis, x.shape);
      keepDimsShape = axis_util.expandShapeToKeepDim(norm.shape, axes);
    }
    return norm.reshape(keepDimsShape);
  }
}

function normInternal<D extends DataType>(
    x: NDArray<D>, p: number|string,
    axis: number|number[] = null): NDArray<D|SumTypes[D]> {
  // scalar
  if (x.rank === 0) {
    return unary_ops.Ops.abs(x);
  }

  // consider vector when no axis is specified
  if (x.rank !== 1 && axis === null) {
    return normInternal(x.reshape([-1]), p, axis);
  }

  // vector
  if (x.rank === 1 || typeof axis === 'number' ||
      axis instanceof Array && axis.length === 1) {
    if (p === 1) {
      return reduction_ops.Ops.sum(unary_ops.Ops.abs(x), axis);
    }
    if (p === Infinity) {
      return reduction_ops.Ops.max(unary_ops.Ops.abs(x), axis);
    }
    if (p === -Infinity) {
      return reduction_ops.Ops.min(unary_ops.Ops.abs(x), axis);
    }
    if (p === 'euclidean' || p === 2) {
      // norm(x, 2) = sum(abs(xi) ^ 2) ^ 1/2
      return unary_ops.Ops.sqrt(reduction_ops.Ops.sum(
          binary_ops.Ops.pow(unary_ops.Ops.abs(x), Scalar.new(2, 'int32')),
          axis));
    }

    throw new Error(`Error in norm: invalid ord value: ${p}`);
  }

  // matrix (assumption axis[0] < axis[1])
  if (axis instanceof Array && axis.length === 2) {
    if (p === 1) {
      return reduction_ops.Ops.max(
          reduction_ops.Ops.sum(unary_ops.Ops.abs(x), axis[0]), axis[1] - 1);
    }
    if (p === Infinity) {
      return reduction_ops.Ops.max(
          reduction_ops.Ops.sum(unary_ops.Ops.abs(x), axis[1]), axis[0]);
    }
    if (p === -Infinity) {
      return reduction_ops.Ops.min(
          reduction_ops.Ops.sum(unary_ops.Ops.abs(x), axis[1]), axis[0]);
    }
    if (p === 'fro' || p === 'euclidean') {
      // norm(x) = sqrt(sum(pow(x, 2)))
      return unary_ops.Ops.sqrt(reduction_ops.Ops.sum(
          binary_ops.Ops.pow(x, Scalar.new(2, 'int32')), axis));
    }

    throw new Error(`Error in norm: invalid ord value: ${p}`);
  }

  throw new Error(`Error in norm: invalid axis: ${axis}`);
}
