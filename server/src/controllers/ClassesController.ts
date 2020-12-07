import { Request, Response } from 'express';

import db from '../database/connection';
import convertHourToMinutes from '../utils/convertHourToMinutes';

interface schenduleItem {
  week_day: number;
  from: string;
  to: string;
}

export default class ClassesController {
  async index(request: Request, response: Response) {
    const filters = request.query;

    const subject = filters.subject as string;
    const week_day = filters.week_day as string;
    const time = filters.time as string;

    if (!filters.week_day || !filters.subject || !filters.time) {
      return response.status(400).json({
        error: 'Missing filters to search classes'
      })
    }

    const timeInMinutes = convertHourToMinutes(time);

    const classes = await db('classes')
      .whereExists(function() {
        this.select('class_schendule.*')
          .from('class_schendule')
          .whereRaw('`class_schendule`.`class_id` = `classes`.`id`')
          .whereRaw('`class_schendule`.`week_day` = ??', [Number(week_day)])
          .whereRaw('`class_schendule`.`from`<= ??', [timeInMinutes])
          .whereRaw('`class_schendule`.`to` > ??', [timeInMinutes])
      })
      .where('classes.subject', '=', subject)
      .join('users', 'classes.user_id', '=', 'users.id')
      .select(['classes.*', 'users.*']);

    return response.json(classes);
  }

  async create(request: Request, response: Response) {
    const {
      name,
      avatar,
      whatsapp,
      bio,
      subject,
      cost,
      schendule
    } = request.body;
  
    const trx = await db.transaction();
  
    try {
      const insertedUsersIds = await trx('users').insert({
        name,
        avatar,
        whatsapp,
        bio
      });
    
      const user_id = insertedUsersIds[0];
    
      const insertedClassesIds = await trx('classes').insert({
        subject,
        cost,
        user_id
      })
    
      const class_id = insertedClassesIds[0];
    
      const classSchendule = schendule.map((schenduleItem: schenduleItem) => {
        return {
          class_id,
          week_day: schenduleItem.week_day,
          from: convertHourToMinutes(schenduleItem.from),
          to: convertHourToMinutes(schenduleItem.to),
        };
      })
    
      await trx('class_schendule').insert(classSchendule);
    
      await trx.commit();
    
      return response.status(201).send();
    } catch (err) {
      console.log(err);
      await trx.rollback();
  
      return response.status(400).json({
        error: 'Unexpected error while creating new class'
      })
    }
  }
}