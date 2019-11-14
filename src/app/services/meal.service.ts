import { Injectable } from '@nestjs/common';
import MealInterface from '../interfaces/meal.interface';
import MealEntity from '../db/entities/meal.entity';

@Injectable()
export class MealService {

  findAll(): Promise<MealInterface[]> {
    return MealEntity.find();
  }
}
